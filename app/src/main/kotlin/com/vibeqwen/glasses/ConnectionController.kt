package com.vibeqwen.glasses

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.Context
import android.content.Intent
import com.vibeqwen.glasses.audio.AudioPipeline
import com.vibeqwen.glasses.audio.RecordingRepository
import com.vibeqwen.glasses.bluetooth.ClassicBtTransport
import com.vibeqwen.glasses.bluetooth.DeviceScanner
import com.vibeqwen.glasses.model.RecordingItem
import com.vibeqwen.glasses.protocol.QwenCommands
import com.vibeqwen.glasses.protocol.QwenConstants
import com.vibeqwen.glasses.protocol.QwenEvents
import com.vibeqwen.glasses.protocol.QwenFrameParser
import com.vibeqwen.glasses.protocol.QwenHandshake
import com.vibeqwen.glasses.protocol.QwenEvent
import com.vibeqwen.glasses.protocol.HandshakeState
import com.vibeqwen.glasses.service.GlassesConnectionService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.channels.Channel
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.io.File
import java.nio.charset.StandardCharsets
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/** 连接状态（UI 顶层状态机） */
enum class ConnectionState {
    DISCONNECTED, CONNECTING, CONNECTED, HANDSHAKING, READY, FAILED
}

/** 录音状态 */
enum class RecordingState {
    IDLE, STARTING, RECORDING, STOPPING
}

/**
 * 连接控制器：整个 APP 的状态与逻辑中枢（单进程单例，由 [GlassesApp] 持有）。
 *
 * 职责：
 *  - 持有 [ClassicBtTransport]（蓝牙连接）与 [AudioPipeline]（落盘）；
 *  - 驱动握手状态机（[QwenHandshake]）进入 READY；
 *  - 把读循环字节按魔数头分用为「音频帧 / JSON 事件」；
 *  - 通过 StateFlow 向 Compose UI 暴露状态，通过 SharedFlow 暴露瞬时消息。
 *
 * 前台服务 [GlassesConnectionService] 仅负责通知栏 / WakeLock 与进程保活，
 * 其生命周期由本控制器在录音开始时拉起、停止时释放。
 */
class ConnectionController(private val appContext: Context) {

    private val _connectionState = MutableStateFlow(ConnectionState.DISCONNECTED)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _handshakeState = MutableStateFlow(HandshakeState.IDLE)
    val handshakeState: StateFlow<HandshakeState> = _handshakeState.asStateFlow()

    private val _recordingState = MutableStateFlow(RecordingState.IDLE)
    val recordingState: StateFlow<RecordingState> = _recordingState.asStateFlow()

    private val _amplitude = MutableStateFlow(0f)
    val amplitude: StateFlow<Float> = _amplitude.asStateFlow()

    private val _db = MutableStateFlow(Float.NEGATIVE_INFINITY)
    val db: StateFlow<Float> = _db.asStateFlow()

    private val _deviceName = MutableStateFlow<String?>(null)
    val deviceName: StateFlow<String?> = _deviceName.asStateFlow()

    private val _lastError = MutableStateFlow<String?>(null)
    val lastError: StateFlow<String?> = _lastError.asStateFlow()

    private val _toast = MutableSharedFlow<String>(extraBufferCapacity = 16)
    val toastEvents: SharedFlow<String> = _toast.asSharedFlow()

    private val _recordingsChanged = MutableSharedFlow<Unit>(extraBufferCapacity = 1)
    val recordingsChanged: SharedFlow<Unit> = _recordingsChanged.asSharedFlow()

    val recordingsDir: File = run {
        val base = appContext.getExternalFilesDir("Music")
            ?: appContext.filesDir
        File(base, "vibeQwenGlasses").also { it.mkdirs() }
    }

    private var transport: ClassicBtTransport? = null
    private var pipeline: AudioPipeline? = null
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private val incoming = Channel<ByteArray>(Channel.UNLIMITED)
    private val demux = Demux()
    private var watchdogJob: Job? = null
    private var serviceRef: GlassesConnectionService? = null
    private var lastAmpEmit = 0L

    init {
        // 单消费者：把字节流分用为音频帧 / JSON 事件
        scope.launch {
            for (bytes in incoming) {
                demux.append(bytes)
                demux.process(
                    onFrame = { handleFrame(it) },
                    onJson = { handleJson(it) }
                )
            }
        }
    }

    // ──────────────────────────── 连接 ────────────────────────────

    @SuppressLint("MissingPermission")
    fun connect(device: BluetoothDevice) {
        scope.launch {
            _lastError.value = null
            _connectionState.value = ConnectionState.CONNECTING
            val t = ClassicBtTransport(device, QwenConstants.SPP_UUID, QwenConstants.AUDIO_SPP_UUID)
            if (!t.connect()) {
                _connectionState.value = ConnectionState.FAILED
                _lastError.value = "无法连接眼镜（RFCOMM 握手失败，请确认已配对且官方 APP 未占用）"
                return@launch
            }
            transport = t
            _deviceName.value = device.name
            _connectionState.value = ConnectionState.CONNECTED
            QwenFrameParser.resetSequence()
            t.startReading { bytes -> incoming.trySend(bytes) }

            _connectionState.value = ConnectionState.HANDSHAKING
            try {
                QwenHandshake.run(
                    write = { txt -> t.write(txt) },
                    onState = { _handshakeState.value = it }
                )
                _connectionState.value = ConnectionState.READY
                _toast.tryEmit("连接就绪，可以开始录音")
            } catch (e: Exception) {
                _connectionState.value = ConnectionState.FAILED
                _lastError.value = "握手失败：${e.message}"
            }
        }
    }

    /** 按 MAC 连接已配对设备 */
    fun connectByAddress(address: String) {
        val adapter = (appContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
            ?: (appContext.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothAdapter)
        val dev = DeviceScanner.findByAddress(adapter, address)
        if (dev == null) {
            _lastError.value = "未找到已配对设备 $address"
            return
        }
        connect(dev)
    }

    fun disconnect() {
        scope.launch {
            stopRecording()
            transport?.disconnect()
            transport = null
            pipeline?.let { runCatching { it.stop() } }
            pipeline = null
            QwenHandshake.reset()
            _handshakeState.value = HandshakeState.IDLE
            _connectionState.value = ConnectionState.DISCONNECTED
            _deviceName.value = null
        }
    }

    // ──────────────────────────── 录音 ────────────────────────────

    fun startRecording() {
        val cs = _connectionState.value
        if (cs != ConnectionState.READY && cs != ConnectionState.CONNECTED) {
            _lastError.value = "眼镜尚未就绪（当前：$cs）"
            return
        }
        scope.launch {
            _recordingState.value = RecordingState.STARTING
            ensureService()
            val cmds = QwenCommands.buildStartRecord()
            try {
                cmds.forEach { transport?.write(it) }
            } catch (e: Exception) {
                _lastError.value = "下发录音指令失败：${e.message}"
                _recordingState.value = RecordingState.IDLE
                return@launch
            }
            val name = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
            pipeline = AudioPipeline(recordingsDir)
            pipeline?.start("rec_$name")
            _recordingState.value = RecordingState.RECORDING
            serviceRef?.startRecordingForeground()
            startWatchdog()
        }
    }

    fun stopRecording() {
        if (_recordingState.value == RecordingState.IDLE) return
        scope.launch {
            _recordingState.value = RecordingState.STOPPING
            try {
                QwenCommands.buildStopRecord().forEach { transport?.write(it) }
            } catch (_: Exception) {
            }
            val items = runCatching { pipeline?.stop() }.getOrNull() ?: emptyList()
            pipeline = null
            stopWatchdog()
            serviceRef?.stopRecordingForeground()
            _recordingState.value = RecordingState.IDLE
            _amplitude.value = 0f
            _db.value = Float.NEGATIVE_INFINITY
            if (items.isNotEmpty()) {
                _recordingsChanged.tryEmit(Unit)
                _toast.tryEmit("已保存 ${items.size} 个切片")
            }
        }
    }

    // ───────────────────── 读循环分用处理 ─────────────────────

    private fun handleFrame(frame: ByteArray) {
        val samples = QwenFrameParser.parseFrame(frame) ?: return
        // 实时电平（节流到 ~30Hz）
        val now = System.currentTimeMillis()
        if (now - lastAmpEmit >= 33) {
            _amplitude.value = QwenFrameParser.computeAmplitude(samples)
            _db.value = QwenFrameParser.computeDb(samples)
            lastAmpEmit = now
        }
        if (_recordingState.value == RecordingState.RECORDING) {
            pipeline?.pushFrame(samples)
        }
    }

    private fun handleJson(json: String) {
        QwenHandshake.onIncoming(json)
        val ev = QwenEvents.parse(json) ?: return
        when (ev) {
            is QwenEvent.RecordStart -> {
                // 眼镜侧已开始推流；若本端还未进入 RECORDING（眼镜发起场景），也标记录音中
                if (_recordingState.value == RecordingState.IDLE) {
                    pipeline = AudioPipeline(recordingsDir)
                    pipeline?.start("rec_glasses_${System.currentTimeMillis()}")
                    _recordingState.value = RecordingState.RECORDING
                    ensureService()
                    serviceRef?.startRecordingForeground()
                    startWatchdog()
                }
            }
            is QwenEvent.RecordEnd -> {
                // 眼镜侧已停止（眼镜结束场景）
                if (_recordingState.value == RecordingState.RECORDING) {
                    scope.launch { finalizeRecording() }
                }
            }
            is QwenEvent.TaskState -> {
                // 状态变化可用于日志；RECORDING 已由指令/事件驱动
            }
            // 握手事件已由 QwenHandshake.onIncoming 消费（门闩驱动），这里无需额外处理
            is QwenEvent.ActiveData, is QwenEvent.PairInfo,
            is QwenEvent.Type10001Q, is QwenEvent.AttachSuccess -> Unit
            is QwenEvent.Other -> { /* 心跳/同步/遥测：保持连接活性 */ }
        }
    }

    private suspend fun finalizeRecording() {
        val items = runCatching { pipeline?.stop() }.getOrNull() ?: emptyList()
        pipeline = null
        stopWatchdog()
        serviceRef?.stopRecordingForeground()
        _recordingState.value = RecordingState.IDLE
        _amplitude.value = 0f
        _db.value = Float.NEGATIVE_INFINITY
        if (items.isNotEmpty()) {
            _recordingsChanged.tryEmit(Unit)
            _toast.tryEmit("眼镜已结束，保存 ${items.size} 个切片")
        }
    }

    // ───────────────────── 前台服务 / Watchdog ─────────────────────

    private fun ensureService() {
        val intent = Intent(appContext, GlassesConnectionService::class.java)
        appContext.startForegroundService(intent)
    }

    fun attachService(service: GlassesConnectionService) {
        serviceRef = service
        if (_recordingState.value == RecordingState.RECORDING) {
            service.startRecordingForeground()
        }
    }

    fun detachService() {
        serviceRef = null
    }

    private fun startWatchdog() {
        watchdogJob?.cancel()
        watchdogJob = scope.launch {
            while (true) {
                delay(1000)
                if (_recordingState.value != RecordingState.RECORDING) break
                val since = pipeline?.sinceLastFrameMs() ?: return@launch
                if (since > 3000) {
                    _toast.tryEmit("警告：超过 3 秒无音频数据，可能已断流")
                }
            }
        }
    }

    private fun stopWatchdog() {
        watchdogJob?.cancel()
        watchdogJob = null
    }

    // ───────────────────── 录音列表辅助 ─────────────────────

    fun listRecordings(): List<RecordingItem> = RecordingRepository.list(recordingsDir)

    fun deleteRecording(path: String) {
        if (RecordingRepository.delete(path)) _recordingsChanged.tryEmit(Unit)
    }

    /** 清除最近一次错误（UI 已展示后调用） */
    fun clearError() {
        _lastError.value = null
    }

    /** 字节流分用器：把混流按「魔数帧 / JSON 行」切分 */
    private class Demux {
        private var data = ByteArray(16 * 1024)
        private var pos = 0
        private var len = 0

        fun append(b: ByteArray) {
            ensure(len + b.size)
            b.copyInto(data, len)
            len += b.size
        }

        fun process(onFrame: (ByteArray) -> Unit, onJson: (String) -> Unit) {
            while (true) {
                val frame = takeFrame()
                if (frame != null) {
                    onFrame(frame)
                    continue
                }
                val line = takeLine()
                if (line != null) {
                    if (line.isNotEmpty()) onJson(line)
                    continue
                }
                break
            }
            // 安全护栏：缓冲过大且无进展时清空，避免 OOM
            if (len - pos > 256 * 1024) {
                pos = len
                compact()
            }
        }

        private fun takeFrame(): ByteArray? {
            if (len - pos < QwenConstants.AUDIO_FRAME_SIZE) return null
            for (i in QwenConstants.AUDIO_FRAME_MAGIC.indices) {
                if (data[pos + i] != QwenConstants.AUDIO_FRAME_MAGIC[i]) return null
            }
            val frame = ByteArray(QwenConstants.AUDIO_FRAME_SIZE)
            data.copyInto(frame, 0, pos, pos + QwenConstants.AUDIO_FRAME_SIZE)
            pos += QwenConstants.AUDIO_FRAME_SIZE
            compact()
            return frame
        }

        private fun takeLine(): String? {
            val nl = indexOfNewline(pos)
            if (nl >= 0) {
                val line = String(data, pos, nl - pos, StandardCharsets.UTF_8).trim()
                pos = nl + 1
                compact()
                return line
            }
            // 无换行兜底：整段是否为单个完整 JSON 对象（部分固件不加换行）
            if (len - pos > 0) {
                val candidate = String(data, pos, len - pos, StandardCharsets.UTF_8).trim()
                if (candidate.startsWith("{") && candidate.endsWith("}")) {
                    try {
                        org.json.JSONObject(candidate)
                        pos = len
                        compact()
                        return candidate
                    } catch (_: Exception) {
                        // 不完整，等待更多数据
                    }
                }
            }
            return null
        }

        private fun indexOfNewline(from: Int): Int {
            for (i in from until len) {
                if (data[i] == '\n'.code.toByte()) return i
            }
            return -1
        }

        private fun ensure(need: Int) {
            if (need <= data.size) return
            var cap = data.size
            while (cap < need) cap *= 2
            val nd = ByteArray(cap)
            data.copyInto(nd, 0, pos, len)
            len -= pos
            pos = 0
            data = nd
        }

        private fun compact() {
            if (pos > 8192) {
                data.copyInto(data, 0, pos, len)
                len -= pos
                pos = 0
            }
        }
    }
}

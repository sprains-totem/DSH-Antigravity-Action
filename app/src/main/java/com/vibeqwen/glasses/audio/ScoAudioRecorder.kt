package com.vibeqwen.glasses.audio

import android.annotation.SuppressLint
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.media.AudioFormat
import android.media.AudioManager
import android.media.AudioRecord
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import com.vibeqwen.glasses.protocol.QwenConstants
import com.vibeqwen.glasses.util.LogCollector

/**
 * 蓝牙 SCO 音频录音器：
 * 当眼镜以 HFP/免提模式连接到手机时，开启 SCO 链路并通过标准 AudioRecord 获取 16kHz 16bit 单声道 PCM 流。
 */
class ScoAudioRecorder(
    private val context: Context,
    private val onPcmChunk: (ByteArray) -> Unit
) {
    private val tag = "ScoAudioRecorder"
    private val audioManager = context.getSystemService(Context.AUDIO_SERVICE) as AudioManager

    @Volatile
    private var isRecording = false
    private var recordThread: Thread? = null
    private var audioRecord: AudioRecord? = null
    private var scoReceiver: BroadcastReceiver? = null

    @SuppressLint("MissingPermission")
    fun start() {
        if (isRecording) return
        isRecording = true
        LogCollector.r("启动蓝牙 SCO 音频录音器...")

        try {
            // 1. 注册 SCO 状态广播监听
            scoReceiver = object : BroadcastReceiver() {
                override fun onReceive(context: Context?, intent: Intent?) {
                    val state = intent?.getIntExtra(AudioManager.EXTRA_SCO_AUDIO_STATE, -1) ?: -1
                    LogCollector.r("蓝牙 SCO 状态变更: $state (1=CONNECTED, 0=DISCONNECTED, 2=CONNECTING)")
                }
            }
            val filter = IntentFilter(AudioManager.ACTION_SCO_AUDIO_STATE_UPDATED)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                context.registerReceiver(scoReceiver, filter, Context.RECEIVER_NOT_EXPORTED)
            } else {
                context.registerReceiver(scoReceiver, filter)
            }

            // 2. 开启蓝牙 SCO 路由
            audioManager.mode = AudioManager.MODE_IN_COMMUNICATION
            audioManager.startBluetoothSco()
            audioManager.isBluetoothScoOn = true
        } catch (e: Exception) {
            LogCollector.e("开启蓝牙 SCO 失败: ${e.message}")
        }

        // 3. 启动 AudioRecord 采集线程
        recordThread = Thread({
            android.os.Process.setThreadPriority(android.os.Process.THREAD_PRIORITY_AUDIO)
            val sampleRate = QwenConstants.SAMPLE_RATE
            val channelConfig = AudioFormat.CHANNEL_IN_MONO
            val audioFormat = AudioFormat.ENCODING_PCM_16BIT
            val minBufSize = AudioRecord.getMinBufferSize(sampleRate, channelConfig, audioFormat)
            val bufSize = maxOf(minBufSize, 4096)

            val record = try {
                AudioRecord(
                    MediaRecorder.AudioSource.VOICE_COMMUNICATION,
                    sampleRate,
                    channelConfig,
                    audioFormat,
                    bufSize
                )
            } catch (e: Exception) {
                LogCollector.e("AudioRecord 创建失败: ${e.message}")
                return@Thread
            }
            audioRecord = record

            if (record.state != AudioRecord.STATE_INITIALIZED) {
                LogCollector.e("AudioRecord 未初始化成功")
                return@Thread
            }

            try {
                record.startRecording()
                LogCollector.r("AudioRecord 开始采集 16kHz PCM 数据")
            } catch (e: Exception) {
                LogCollector.e("startRecording 失败: ${e.message}")
                return@Thread
            }

            // 每次读取 384 字节 (192 samples = 12ms @ 16kHz)
            val chunkSize = QwenConstants.AUDIO_PCM_SIZE
            val chunk = ByteArray(chunkSize)

            while (isRecording) {
                var bytesRead = 0
                while (bytesRead < chunkSize && isRecording) {
                    val n = record.read(chunk, bytesRead, chunkSize - bytesRead)
                    if (n > 0) {
                        bytesRead += n
                    } else if (n < 0) {
                        Log.e(tag, "AudioRecord.read 错误: $n")
                        break
                    }
                }
                if (bytesRead == chunkSize && isRecording) {
                    onPcmChunk(chunk.copyOf())
                }
            }

            try {
                record.stop()
                record.release()
            } catch (_: Exception) {
            }
            LogCollector.r("AudioRecord 采集线程退出")
        }, "vqg-sco-recorder").apply {
            isDaemon = true
            start()
        }
    }

    fun stop() {
        if (!isRecording) return
        isRecording = false
        LogCollector.r("停止蓝牙 SCO 音频录音器...")

        try {
            audioRecord?.stop()
        } catch (_: Exception) {}

        try {
            recordThread?.join(500)
        } catch (_: Exception) {}
        recordThread = null
        audioRecord = null

        try {
            audioManager.stopBluetoothSco()
            audioManager.isBluetoothScoOn = false
            audioManager.mode = AudioManager.MODE_NORMAL
        } catch (e: Exception) {
            Log.w(tag, "关闭 SCO 异常: ${e.message}")
        }

        try {
            scoReceiver?.let { context.unregisterReceiver(it) }
            scoReceiver = null
        } catch (_: Exception) {}
    }
}
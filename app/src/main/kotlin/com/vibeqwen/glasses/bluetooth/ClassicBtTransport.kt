package com.vibeqwen.glasses.bluetooth

import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import com.vibeqwen.glasses.protocol.QwenConstants
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.isActive
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import java.io.IOException
import java.io.InputStream
import java.io.OutputStream
import java.nio.charset.StandardCharsets
import java.util.UUID

/**
 * 传输层（L2CAP 优先 + RFCOMM 兜底）。
 *
 * 依据官方千问 APP 源码逆向（2026-08-30 确认）：
 *  - 官方 APP 用 **L2CAP PSM=130** 连接眼镜（`BleL2capClient`，
 *    `connectExclusive: connect target addr=..., psm=130`），
 *    不是 RFCOMM！此前用 RFCOMM UUID 连不上是根因。
 *  - `createL2capChannel(130)`（Android 10+, API 29+）
 *  - RFCOMM（0x1101 等）仅作兜底。
 */
class ClassicBtTransport(
    private val device: BluetoothDevice,
    private val sppUuid: UUID,
    private val audioUuid: UUID? = null
) {
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private var controlSocket: BluetoothSocket? = null
    private var audioSocket: BluetoothSocket? = null

    /** 官方 L2CAP PSM（从官方 APP 逆向确认） */
    private val L2CAP_PSM: Int = QwenConstants.L2CAP_PSM

    /** 是否已建立任一连接 */
    val isConnected: Boolean
        get() = controlSocket?.isConnected == true || audioSocket?.isConnected == true

    /** 先试 L2CAP（PSM=130），失败再试 RFCOMM */
    private fun openControlSocket(): BluetoothSocket? {
        // 1) L2CAP CoC（官方方式）
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
            try {
                return device.createL2capChannel(L2CAP_PSM).also { it.connect() }
            } catch (_: Exception) {
                // L2CAP 失败，回退 RFCOMM
            }
        }
        // 2) RFCOMM 候选（兜底）
        val candidates = listOf(sppUuid, QwenConstants.BES_DATA_UUID, QwenConstants.BES_CTRL_UUID)
            .distinct()
        for (uuid in candidates) {
            val s = openRfcomm(uuid)
            if (s != null) return s
        }
        return null
    }

    private fun openRfcomm(uuid: UUID): BluetoothSocket? {
        return try {
            device.createRfcommSocketToServiceRecord(uuid).also { it.connect() }
        } catch (secure: IOException) {
            try {
                @Suppress("MissingPermission")
                device.createInsecureRfcommSocketToServiceRecord(uuid).also { it.connect() }
            } catch (insecure: IOException) {
                null
            }
        }
    }

    /**
     * 建立连接。
     * @return true 表示控制通道连接成功（音频通道可选，失败不致命）
     */
    @Synchronized
    fun connect(): Boolean {
        controlSocket = openControlSocket()
        if (controlSocket == null) return false
        if (audioUuid != null) {
            audioSocket = openRfcomm(audioUuid)
        }
        return true
    }

    /**
     * 启动读循环，把任意一路 socket 的字节都交给 [onBytes]（上层负责帧/JSON 分用）。
     */
    fun startReading(onBytes: (ByteArray) -> Unit) {
        controlSocket?.let { launchRead(it.inputStream, onBytes) }
        audioSocket?.let { launchRead(it.inputStream, onBytes) }
    }

    private fun launchRead(stream: InputStream, onBytes: (ByteArray) -> Unit) {
        scope.launch {
            val buf = ByteArray(4096)
            try {
                while (isActive) {
                    val n = stream.read(buf)
                    if (n <= 0) break
                    onBytes(buf.copyOf(n))
                }
            } catch (_: IOException) {
                // 连接断开，由上层感知
            }
        }
    }

    /** 下发一行 JSON 文本（控制通道） */
    fun write(text: String) {
        writeBytes(text.toByteArray(StandardCharsets.UTF_8))
    }

    /** 下发原始字节（控制通道）——支持官方私有帧封装 */
    fun writeBytes(bytes: ByteArray) {
        val out: OutputStream? = controlSocket?.outputStream
        if (out == null) throw IOException("control socket 未连接")
        out.write(bytes)
        out.flush()
    }

    @Synchronized
    fun disconnect() {
        scope.coroutineContext[Job]?.cancel()
        quietlyClose(controlSocket)
        quietlyClose(audioSocket)
        controlSocket = null
        audioSocket = null
    }

    private fun quietlyClose(socket: BluetoothSocket?) {
        try {
            socket?.close()
        } catch (_: IOException) {
        }
    }
}
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
 * 经典蓝牙（RFCOMM）传输层。
 *
 * 设计要点（依据 PROTOCOL.md §4.1、§6.1 与 ARCHITECTURE.md §4.1）：
 *  - 控制通道：createRfcommSocketToServiceRecord(sppUuid) 连接，下发 JSON（CID 0x004A）；
 *  - 音频通道：若眼镜把音频放在独立 RFCOMM 通道（audioUuid 非空），另开一路 socket；
 *    否则音频帧与控制帧混在同一路，由上层读循环按魔数头全局匹配（见 QwenFrameParser）。
 *  - 两条读循环把原始字节统一喂给同一回调 [onBytes]，由上层做「JSON 行 / 音频帧」分用。
 */
class ClassicBtTransport(
    private val device: BluetoothDevice,
    private val sppUuid: UUID,
    private val audioUuid: UUID? = null
) {
    private val scope = CoroutineScope(Dispatchers.IO + Job())
    private var controlSocket: BluetoothSocket? = null
    private var audioSocket: BluetoothSocket? = null

    /** 是否已建立任一连接 */
    val isConnected: Boolean
        get() = controlSocket?.isConnected == true || audioSocket?.isConnected == true

    private fun openSocket(uuid: UUID): BluetoothSocket? {
        return try {
            device.createRfcommSocketToServiceRecord(uuid).also { it.connect() }
        } catch (secure: IOException) {
            // 部分眼镜仅接受 insecure RFCOMM
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
        // 按候选顺序依次尝试：BES 私有控制 0x03F0 → 数据 0x03FD → 标准 SPP
        val candidates = listOf(sppUuid, QwenConstants.CONTROL_SPP_UUID)
            .distinct()
        for (uuid in candidates) {
            controlSocket = openSocket(uuid)
            if (controlSocket != null) {
                break
            }
        }
        if (controlSocket == null) return false
        if (audioUuid != null) {
            audioSocket = openSocket(audioUuid)
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
        val out: OutputStream? = controlSocket?.outputStream
        if (out == null) throw IOException("control socket 未连接")
        out.write(text.toByteArray(StandardCharsets.UTF_8))
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

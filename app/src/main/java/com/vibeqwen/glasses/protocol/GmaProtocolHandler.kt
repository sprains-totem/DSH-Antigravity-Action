package com.vibeqwen.glasses.protocol

import com.vibeqwen.glasses.util.LogCollector
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * GMA (Genie Mobile Accessory) / GCSP 二进制协议解析与自动应答器。
 *
 * 反编译自官方 APP (com.alibaba.wow classes4.dex)：
 * - GCSP 帧结构 (v1 / v2)
 * - GMA 命令帧：namespace, commandId, msgId, payload
 * - 收到眼镜的 GMA 请求命令后自动生成标准应答帧并回包给眼镜
 */
object GmaProtocolHandler {

    /**
     * 尝试解析接收到的原始二进制包。
     * @return 如果是 GMA 二进制请求，返回对应的 ACK 应答包；否则返回 null
     */
    fun handleIncomingBytes(bytes: ByteArray): ByteArray? {
        if (bytes.size < 6) return null

        val hex = bytes.take(32).joinToString("") { "%02X".format(it) }
        LogCollector.log("GMA", "收到原始包 (${bytes.size}B): $hex")

        // 1. GCSP 版本协商应答 (0x0002) 或 请求 (0x0001)
        if (bytes.size >= 8 && bytes.contains(0x47.toByte()) && bytes.contains(0x43.toByte())) {
            val idx = bytes.indexOf(0x47.toByte())
            if (idx >= 0 && idx + 4 < bytes.size && bytes[idx + 1] == 0x43.toByte()) {
                val opcode = ((bytes[idx + 2].toInt() and 0xFF) shl 8) or (bytes[idx + 3].toInt() and 0xFF)
                val ver = bytes[idx + 4].toInt() and 0xFF
                LogCollector.h("GCSP 协议握手帧: opcode=0x%04X, version=%d".format(opcode, ver))
                // 如果眼镜在请求协商，回复版本 2 应答
                if (opcode == 0x0001) {
                    return byteArrayOf(
                        0x08, 0x00, 0x00, 0x00, 0x05, 0x47, 0x43, 0x00, 0x02, 0x02
                    )
                }
                return null
            }
        }

        // 2. GMA 二进制消息解析 (如 01 00 09 20 00 49 03 0B 00 00 00 00)
        // 结构：[0..1] CID (0x0001), [2..3] CmdId (0x2009), [4] Flag (0x00), [5..6] MsgId (0x0349), [7..] Payload
        try {
            val cid = (bytes[0].toInt() and 0xFF) or ((bytes[1].toInt() and 0xFF) shl 8)
            if (cid == 0x0001 || cid == 0x0041 || cid == 0x004A) {
                val cmdId = (bytes[2].toInt() and 0xFF) or ((bytes[3].toInt() and 0xFF) shl 8)
                val flag = bytes[4].toInt() and 0xFF
                val msgIdLow = bytes[5].toInt() and 0xFF
                val msgIdHigh = if (bytes.size > 6) bytes[6].toInt() and 0xFF else 0
                val msgId = msgIdLow or (msgIdHigh shl 8)
                LogCollector.p("GMA 二进制命令: CID=0x%04X, cmd=0x%04X, msgId=0x%04X, flag=0x%02X".format(cid, cmdId, msgId, flag))

                // 回复官方抓包确认的标准 GMA 应答 (12 字节)
                // 格式：0C 00 01 00 09 00 00 [MsgId: 2B] 0F 0D 00 00 00
                val ack = byteArrayOf(
                    0x0C, 0x00, 0x01, 0x00, 0x09, 0x00, 0x00,
                    msgIdLow.toByte(), msgIdHigh.toByte(),
                    0x0F, 0x0D, 0x00
                )
                LogCollector.h("生成 GMA ACK: " + ack.joinToString("") { "%02X".format(it) })
                return ack
            }
        } catch (e: Exception) {
            LogCollector.e("GMA 解析异常: ${e.message}")
        }

        return null
    }

    /**
     * 构造 GMA 标准应答帧 (ACK)
     */
    fun buildGmaAck(cid: Int, ns: Int, cmdId: Int, msgId: Int, status: Int = 0): ByteArray {
        val payload = byteArrayOf(
            status.toByte(), // 状态码 0 = 成功
            0x00, 0x00, 0x00
        )
        // 构造 GMA 响应载荷
        val gmaPayload = ByteBuffer.allocate(8 + payload.size).order(ByteOrder.LITTLE_ENDIAN).apply {
            putShort(cmdId.toShort())
            put(ns.toByte())
            put(msgId.toByte())
            put(0x01.toByte()) // Response Type
            put(0x00.toByte())
            putShort(payload.size.toShort())
            put(payload)
        }.array()

        // 封装为 GCSP v2 数据帧 (带 CRC16)
        val frame = QwenFramer.wrap(gmaPayload, msgType = 1, cid = cid, appendCrc = true)
        LogCollector.h("生成 GMA ACK 应答包: " + frame.joinToString("") { "%02X".format(it) })
        return frame
    }
}
package com.vibeqwen.glasses.protocol

import java.io.ByteArrayOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder

/**
 * 官方千问 APP 私有帧封装器（从 HCI 抓包逆向，2026-08-30 确认）。
 *
 * 帧头（10 字节）+ 载荷：
 *   [0..1]  LE 总帧长 = payloadLength - 2
 *   [2..3]  0x0001（普通） / 0x0002|0x0004（大消息分段）
 *   [4..5]  载荷长度+偏移相关（普通消息 = jsonLen + 5 或类似）
 *   [6]     标志（0x00 / 0x08 等）
 *   [7..8]  消息序号（逐条 +1）
 *   [9]     类型标记
 *   [10..]  载荷（JSON 或 node 二进制）
 *
 * 关键：官方 APP 在发送 JSON 握手前，先发送一组二进制/node 初始化消息
 * （appId=com.alibaba.wowbosgAndroid、peerAddr、time、timeZoneId 等），
 * 我们 APP 缺此步骤导致服务不响应。
 */
object QwenFramer {

    /** 消息序号计数器 */
    private var seq: Int = 0

    /** 会话 node 初始化载荷（硬编码官方 APP 格式，peerAddr 为手机侧地址） */
    fun buildNodeInit(peerAddrHex: String = "22:c1:37:10:6e:b4"): ByteArray {
        val baos = ByteArrayOutputStream()
        baos.write(0xbf)
        baos.write("haddrType".toByteArray(Charsets.ISO_8859_1))
        baos.write(0x00)
        baos.write("eappId".toByteArray(Charsets.ISO_8859_1))
        baos.write("ocom.alibaba.wowbosgAndroidhpeerAddrq".toByteArray(Charsets.ISO_8859_1))
        baos.write(peerAddrHex.toByteArray(Charsets.ISO_8859_1))
        baos.write("dtime".toByteArray(Charsets.ISO_8859_1))
        baos.write(byteArrayOf(0x1B, 0x00, 0x00, 0x01, 0xA0.toByte(), 0x52, 0xA4.toByte(), 0x81.toByte(), 0x80.toByte()))
        baos.write("jtimeOffset".toByteArray(Charsets.ISO_8859_1))
        baos.write(byteArrayOf(0x1A, 0x01, 0xB7.toByte(), 0x74, 0x00))
        baos.write("jtimeZoneIdmAsia/Shanghaigversion".toByteArray(Charsets.ISO_8859_1))
        baos.write(byteArrayOf(0x01, 0xFF.toByte()))
        return baos.toByteArray()
    }

    /** 封装一条消息（JSON 或原始字节）为官方帧 */
    fun wrap(payload: ByteArray, msgType: Int = 1): ByteArray {
        val total = 10 + payload.size
        val buf = ByteBuffer.allocate(total).order(ByteOrder.LITTLE_ENDIAN)
        buf.putShort((total - 2).toShort())
        buf.putShort(msgType.toShort())
        buf.putShort((payload.size + 5).toShort())
        buf.put(0.toByte())
        buf.putShort(seq.toShort())
        buf.put(1.toByte()) // 类型标记
        seq++
        buf.put(payload)
        return buf.array()
    }

    /** 便捷：封装 JSON 字符串 */
    fun wrapJson(json: String): ByteArray = wrap(json.toByteArray(Charsets.UTF_8))

    /** 便捷：帧 + node 初始化消息（连接后第一条） */
    fun nodeInitFrame(): ByteArray = wrap(buildNodeInit())
}
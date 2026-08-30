package com.vibeqwen.glasses.protocol

import java.util.UUID

/**
 * 千问 G1 眼镜私有蓝牙协议常量。
 * 规格来源：docs/PROTOCOL.md（逆向成果，字节级验证通过）。
 */
object QwenConstants {

    // ── L2CAP 控制通道 CID（眼镜↔手机 JSON）──
    /** 眼镜 → 手机：事件 / 状态 / 心跳 JSON */
    const val CID_EVENT_RX: Int = 0x0041

    /** 手机 → 眼镜：指令 / 配置 / 应答 JSON */
    const val CID_CMD_TX: Int = 0x004A

    // ── 音频帧（眼镜 → 手机，CID 动态 0x0047/0x0048，须按魔数头匹配）──
    /** 音频帧魔数头（每帧前 8 字节），来源 PROTOCOL.md §5.1 */
    val AUDIO_FRAME_MAGIC: ByteArray = byteArrayOf(
        0x87.toByte(), 0xEF.toByte(), 0x12, 0x03, 0x07, 0x01, 0x86.toByte(), 0x08
    )

    /** 单帧总长（字节） */
    const val AUDIO_FRAME_SIZE: Int = 398

    /** 帧头长度：8B 魔数 + 1B 序列号 + 4B 填充 = 13B，之后才是 PCM */
    const val AUDIO_FRAME_HEADER: Int = 13

    /** 每帧有效 PCM 长度（字节）：384B = 192 个 16bit 样本 */
    const val AUDIO_PCM_SIZE: Int = 384

    /** 每帧样本数（16bit LE 单声道） */
    const val AUDIO_SAMPLES_PER_FRAME: Int = AUDIO_PCM_SIZE / 2 // 192

    /** 音频参数：16bit 有符号 LE / 16000Hz / 单声道（协议固定） */
    const val SAMPLE_RATE: Int = 16000
    const val CHANNELS: Int = 1
    const val BITS_PER_SAMPLE: Int = 16

    /**
     * 经典蓝牙 RFCOMM 服务 UUID（BES 私有 SPP 服务）。
     *
     * 来源：对 HCI 日志 SDP 段的分析 + BES2600 芯片公开资料（2026-08-30 确认）：
     *   - 眼镜（恒玄 BES2600）暴露的私有 SPP 服务 UUID = 0x03FD / 0x03F0
     *     （不是标准 SPP 0x1101，故此前用 0x1101 连不上）
     *   - 0x03F0 = 私有控制通道（App 指令交互）
     *   - 0x03FD = 高速数据通道（数据吞吐/遥测/音频）
     * 扩展为标准 128-bit：000003FD-0000-1000-8000-00805F9B34FB
     * 注：若真机 SDP 另有 128-bit 厂商形式，可在此覆盖。
     */
    val SPP_UUID: UUID = UUID.fromString("000003FD-0000-1000-8000-00805F9B34FB")

    /** 可选的控制通道 UUID（若控制与数据分通道）：BES 私有 0x03F0 */
    val CONTROL_SPP_UUID: UUID = UUID.fromString("000003F0-0000-1000-8000-00805F9B34FB")

    /** 可选的第二通道（音频/数据）UUID：与 SPP_UUID 同为 0x03FD 系列 */
    val AUDIO_SPP_UUID: UUID? = null

    // ── 握手关键字段（来源 PROTOCOL.md §3）──
    const val ODM_ID: String = "AILABS_SG02_QW"
    const val DEVICE_SN: String = "D5A74C04894A4E70C2AE0BDC687904FE"
    const val PHONE_TYPE: Int = 1
    const val SUPPORT_HEIC_DECODE: Int = 1

    /** 眼镜目标 MAC（实测：Qwen Glasses G1191C） */
    const val GLASSES_MAC: String = "C4:D7:DC:40:19:1C"

    /** 名称关键字，用于从已配对设备里筛出眼镜 */
    val GLASSES_NAME_HINTS: List<String> = listOf("G1", "QWEN", "GLASSES", "QUARK")

    /** 录音指令常量（来源 PROTOCOL.md §4） */
    const val CODE_AUDIO_RECORDING: String = "AudioRecording"
    const val WAKEUP_TYPE_LONG_RECORD: String = "longRecord"
    const val URI_AI_RECORD_START: String = "airecord://start"
    const val REASON_TOUCH: String = "touch"

    /** 每片录音最大时长（毫秒）：5 分钟切片，参照 vibeARS 思路 */
    const val SLICE_DURATION_MS: Long = 5 * 60 * 1000L
}

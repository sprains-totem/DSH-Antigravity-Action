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
     * 经典蓝牙 RFCOMM 服务 UUID（SPP 0x1101）。
     * 注意：眼镜实际暴露的 RFCOMM 通道 UUID 仍需在真机 SDP 抓包中确认（PROTOCOL.md §8 待办）；
     * 这里默认 SPP，并允许上层在连接时覆盖（例如厂商自定义 UUID）。
     */
    val SPP_UUID: UUID = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB")

    /** 可选的第二通道（音频）UUID：若眼镜把音频与控制放在不同 RFCOMM 通道，可在此配置 */
    val AUDIO_SPP_UUID: UUID? = null

    // ── 握手关键字段（来源 PROTOCOL.md §3）──
    const val ODM_ID: String = "AILABS_SG02_QW"
    const val DEVICE_SN: String = "D5A74C04894A4E70C2AE0BDC687904FE"
    const val PHONE_TYPE: Int = 1
    const val SUPPORT_HEIC_DECODE: Int = 1

    /** 眼镜目标 MAC（来源 START_HERE.md / PROTOCOL.md §8.1 修正） */
    const val GLASSES_MAC: String = "A0:FB:C5:21:9B:20"

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

package com.vibeqwen.glasses.protocol

/**
 * 398B 音频帧解析器（纯 Kotlin，可在 JVM 单测）。
 *
 * 要点（docs/PROTOCOL.md §5 / §9.1）：
 * - 音频通道 L2CAP CID 是【动态】的（0x0047 / 0x0048 因连接而异），
 *   因此必须按魔数头 `87 EF 12 03 07 01 86 08` 全局匹配，而不是依赖通道号。
 * - 帧布局：8B 魔数 + 1B 序号 + 4B 填充 + 384B PCM(16bit LE/16000Hz/单声道) + 1B 填充 = 398B
 * - 容忍：帧跨 socket read 分片、多帧粘包、序号跳变/回绕（不丢弃，仅统计）。
 * - 提取规则：取 [13..396] 共 384B 为 PCM，尾部 1B 丢弃。
 */
class QwenFrameParser {

    /** 单帧解析结果 */
    data class AudioFrame(
        val seq: Int,
        val pcm: ByteArray,
    )

    private var buf = ByteArray(0)
    private var head = 0
    private var lastSeq = -1

    /** 累计解析帧数 */
    var totalFrames = 0L
        private set

    /** 序号跳变累计次数（容忍，不丢帧） */
    var seqJumps = 0L
        private set

    /** 被丢弃的非音频残余字节累计 */
    var droppedBytes = 0L
        private set

    /** 追加网络字节，返回本次解析出的完整音频帧（可能为空） */
    fun feed(data: ByteArray): List<AudioFrame> {
        // 压缩已消费的头部
        if (head > 0) {
            buf = buf.copyOfRange(head, buf.size)
            head = 0
        }
        buf = if (buf.isEmpty()) data.copyOf() else buf + data

        val out = ArrayList<AudioFrame>()
        var idx = indexOfMagic(head)
        while (idx >= 0) {
            // 不足一帧长度：保留等待后续数据
            if (buf.size - idx < QwenConstants.AUDIO_FRAME_SIZE) break

            // 序号（帧内第 9 字节）
            val seq = buf[idx + 8].toInt() and 0xFF
            if (lastSeq >= 0) {
                val expected = (lastSeq + 1) and 0xFF
                if (seq != expected) seqJumps++
            }
            lastSeq = seq

            // 提取 PCM：跳过 13B 帧头，取 384B，尾部 1B 丢弃
            val pcm = buf.copyOfRange(
                idx + QwenConstants.AUDIO_HEADER_SIZE,
                idx + QwenConstants.AUDIO_HEADER_SIZE + QwenConstants.AUDIO_PCM_SIZE
            )
            out.add(AudioFrame(seq, pcm))
            totalFrames++

            val consumed = idx + QwenConstants.AUDIO_FRAME_SIZE
            droppedBytes += (idx - head) // 仅帧前的残余（垃圾/其他协议文本）计入丢弃
            head = consumed
            idx = indexOfMagic(head)
        }

        // 长时间未匹配魔数（例如一段无音频的 AT 协商流）：防缓冲无限增长，丢弃超长残余
        if (idx < 0 && buf.size - head > QwenConstants.AUDIO_FRAME_SIZE * 16) {
            droppedBytes += (buf.size - head)
            head = buf.size
        }
        return out
    }

    /** 新录音段开始前重置统计（序号重新计数） */
    fun reset() {
        buf = ByteArray(0)
        head = 0
        lastSeq = -1
        totalFrames = 0
        seqJumps = 0
        droppedBytes = 0
    }

    private fun indexOfMagic(from: Int): Int {
        val magic = QwenConstants.AUDIO_MAGIC
        var i = from
        val limit = buf.size - magic.size
        while (i <= limit) {
            var ok = true
            for (j in magic.indices) {
                if (buf[i + j] != magic[j]) {
                    ok = false
                    break
                }
            }
            if (ok) return i
            i++
        }
        return -1
    }
}
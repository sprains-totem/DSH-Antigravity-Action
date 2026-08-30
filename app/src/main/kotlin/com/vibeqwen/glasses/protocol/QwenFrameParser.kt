package com.vibeqwen.glasses.protocol

import kotlin.math.ln
import kotlin.math.sqrt

/**
 * 398B 音频帧解析器。
 *
 * 帧布局（来源 PROTOCOL.md §5.1，已字节级验证）：
 *   [0..7]    8B  魔数头 87 EF 12 03 07 01 86 08
 *   [8]       1B  序列号（递增，循环回绕）
 *   [9..12]   4B  填充 00 00 00 00
 *   [13..396] 384B PCM（16bit 有符号 LE / 16000Hz / 单声道）
 *   [397]     1B  填充（丢弃）
 *
 * 关键设计：
 *  - 不依赖固定 CID，由上层按魔数头把整帧喂入 [consume]。
 *  - 序列号跳变容忍（长录音回绕/丢帧），仅做统计，不影响输出。
 */
object QwenFrameParser {

    /** 当前期望序号（用于跳变检测，-1 表示未知） */
    @Volatile
    private var expectedSeq: Int = -1

    /** 累计序号跳变次数（供 UI/日志展示） */
    @Volatile
    var seqJumps: Long = 0
        private set

    fun resetSequence() {
        expectedSeq = -1
        seqJumps = 0
    }

    /**
     * 校验字节数组头部是否为合法音频帧魔数。
     * @return true 表示 [data] 从 [offset] 起是 398B 帧的开头
     */
    fun isFrameStart(data: ByteArray, offset: Int): Boolean {
        if (data.size - offset < QwenConstants.AUDIO_FRAME_SIZE) return false
        for (i in QwenConstants.AUDIO_FRAME_MAGIC.indices) {
            if (data[offset + i] != QwenConstants.AUDIO_FRAME_MAGIC[i]) return false
        }
        return true
    }

    /**
     * 解析一帧（必须是完整 398B，且头部为魔数）。
     * @return 192 个 16bit LE 样本；若魔数不匹配返回 null
     */
    fun parseFrame(frame: ByteArray): ShortArray? {
        if (frame.size < QwenConstants.AUDIO_FRAME_SIZE) return null
        for (i in QwenConstants.AUDIO_FRAME_MAGIC.indices) {
            if (frame[i] != QwenConstants.AUDIO_FRAME_MAGIC[i]) return null
        }

        // 序列号连续性检测（容忍跳变）
        val seq = frame[8].toInt() and 0xFF
        if (expectedSeq >= 0) {
            val expected = (expectedSeq + 1) and 0xFF
            if (seq != expected) seqJumps++
        }
        expectedSeq = seq

        // 取 [13..396] 共 384B → 192 个样本
        val samples = ShortArray(QwenConstants.AUDIO_SAMPLES_PER_FRAME)
        var p = QwenConstants.AUDIO_FRAME_HEADER
        for (i in samples.indices) {
            val lo = frame[p].toInt() and 0xFF
            val hi = frame[p + 1].toInt() and 0xFF
            samples[i] = (lo or (hi shl 8)).toShort()
            p += 2
        }
        return samples
    }

    /**
     * 由 PCM 样本计算当前分贝（dBFS，0dB=满幅）。
     * 用于实时电平表/波形。无数据时返回 -Infinity 表示静音。
     */
    fun computeDb(samples: ShortArray): Float {
        if (samples.isEmpty()) return Float.NEGATIVE_INFINITY
        var sumSq = 0.0
        for (s in samples) {
            val v = s.toDouble() / 32768.0
            sumSq += v * v
        }
        val rms = sqrt(sumSq / samples.size)
        if (rms <= 1e-6) return -90f
        val db = (20 * ln(rms) / ln(10.0)).toFloat()
        return db.coerceAtMost(0f)
    }

    /** 由样本计算归一化幅度（0..1），用于波形高度 */
    fun computeAmplitude(samples: ShortArray): Float {
        if (samples.isEmpty()) return 0f
        var peak = 0
        for (s in samples) {
            val a = kotlin.math.abs(s.toInt())
            if (a > peak) peak = a
        }
        return (peak / 32768f).coerceIn(0f, 1f)
    }
}

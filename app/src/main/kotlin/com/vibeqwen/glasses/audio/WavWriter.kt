package com.vibeqwen.glasses.audio

import com.vibeqwen.glasses.protocol.QwenConstants
import java.io.File
import java.io.RandomAccessFile
import java.nio.charset.StandardCharsets

/**
 * 增量式 WAV 写入器（44 字节头 + PCM 数据，关闭时回填长度字段）。
 *
 * 格式：16bit 有符号 LE / 16000Hz / 单声道（与眼镜协议固定参数一致，见 PROTOCOL.md §5）。
 * 复用 vibeARS 思路：打开时写入占位头，append PCM，close() 时回填 RIFF/data 大小。
 */
class WavWriter(
    private val file: File,
    private val sampleRate: Int = QwenConstants.SAMPLE_RATE,
    private val channels: Int = QwenConstants.CHANNELS,
    private val bitsPerSample: Int = QwenConstants.BITS_PER_SAMPLE
) {
    private val raf: RandomAccessFile
    private var dataLength = 0

    init {
        if (file.exists()) file.delete()
        raf = RandomAccessFile(file, "rw")
        // RIFF 头（44 字节），大小字段先用 0 占位，close() 回填
        raf.write("RIFF".toByteArray(StandardCharsets.US_ASCII))
        writeInt32(0) // RIFF 大小（占位）
        raf.write("WAVE".toByteArray(StandardCharsets.US_ASCII))
        raf.write("fmt ".toByteArray(StandardCharsets.US_ASCII))
        writeInt32(16) // fmt chunk 大小
        writeInt16(1)  // audio format = PCM
        writeInt16(channels)
        writeInt32(sampleRate)
        writeInt32(sampleRate * channels * bitsPerSample / 8) // 字节率
        writeInt16(channels * bitsPerSample / 8)              // block align
        writeInt16(bitsPerSample)
        raf.write("data".toByteArray(StandardCharsets.US_ASCII))
        writeInt32(0) // data 大小（占位）
    }

    fun writeSamples(samples: ShortArray) {
        for (s in samples) {
            val v = s.toInt()
            raf.write(v and 0xFF)
            raf.write((v shr 8) and 0xFF)
        }
        dataLength += samples.size * 2
    }

    fun close() {
        raf.seek(4)
        writeInt32(36 + dataLength)
        raf.seek(40)
        writeInt32(dataLength)
        raf.close()
    }

    private fun writeInt32(v: Int) {
        raf.write(v and 0xFF)
        raf.write((v shr 8) and 0xFF)
        raf.write((v shr 16) and 0xFF)
        raf.write((v shr 24) and 0xFF)
    }

    private fun writeInt16(v: Int) {
        raf.write(v and 0xFF)
        raf.write((v shr 8) and 0xFF)
    }
}

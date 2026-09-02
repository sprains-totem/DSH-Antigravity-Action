package com.vibeqwen.glasses.audio

import java.io.BufferedOutputStream
import java.io.File
import java.io.FileOutputStream
import java.io.OutputStream
import java.io.RandomAccessFile

/**
 * 极简 WAV 写入器。
 *
 * 写入 44 字节 RIFF/WAVE 头（大小字段先占位），数据追加写；
 * close() 时回填 RIFF 大小与 data 大小，保证文件可被任意播放器识别。
 * 芯片参数固定：16bit / 16000Hz / 单声道（眼镜协议定死）。
 */
class WavWriter(
    private val file: File,
    private val sampleRate: Int = 16000,
    private val channels: Int = 1,
    private val bitsPerSample: Int = 16,
) {
    private val out: BufferedOutputStream
    private var pcmBytes = 0L
    private var closed = false

    init {
        file.parentFile?.mkdirs()
        out = BufferedOutputStream(FileOutputStream(file))
        writeHeaderPlaceholder()
    }

    /** 写入裸 PCM（16bit LE） */
    fun write(pcm: ByteArray) {
        if (closed) return
        out.write(pcm)
        pcmBytes += pcm.size
    }

    /** 完成写入：刷新缓冲并回填头部大小字段 */
    fun close() {
        if (closed) return
        closed = true
        out.flush()
        out.close()
        RandomAccessFile(file, "rw").use { raf ->
            // RIFF size = 文件总长 - 8 = 36 + data
            raf.seek(4)
            writeIntLE(raf, 36 + pcmBytes)
            // data size
            raf.seek(40)
            writeIntLE(raf, pcmBytes)
        }
    }

    val sizeBytes: Long get() = pcmBytes + 44

    private fun writeHeaderPlaceholder() {
        writeAscii(out, "RIFF")
        writeIntLE(out, 0L)
        writeAscii(out, "WAVE")
        writeAscii(out, "fmt ")
        writeIntLE(out, 16L)
        writeShortLE(out, 1) // PCM
        writeShortLE(out, channels)
        writeIntLE(out, sampleRate.toLong())
        writeIntLE(out, (sampleRate * channels * bitsPerSample / 8).toLong())
        writeShortLE(out, channels * bitsPerSample / 8)
        writeShortLE(out, bitsPerSample)
        writeAscii(out, "data")
        writeIntLE(out, 0L)
    }

    // ── 小端 / ASCII 辅助 ──

    private fun writeAscii(output: OutputStream, s: String) {
        output.write(s.toByteArray(Charsets.US_ASCII))
    }

    private fun writeIntLE(output: OutputStream, value: Long) {
        output.write((value.toInt() and 0xFF))
        output.write(((value shr 8) and 0xFF).toInt())
        output.write(((value shr 16) and 0xFF).toInt())
        output.write(((value shr 24) and 0xFF).toInt())
    }

    private fun writeIntLE(raf: RandomAccessFile, value: Long) {
        raf.write((value.toInt() and 0xFF))
        raf.write(((value shr 8) and 0xFF).toInt())
        raf.write(((value shr 16) and 0xFF).toInt())
        raf.write(((value shr 24) and 0xFF).toInt())
    }

    private fun writeShortLE(output: OutputStream, value: Int) {
        output.write(value and 0xFF)
        output.write((value shr 8) and 0xFF)
    }
}
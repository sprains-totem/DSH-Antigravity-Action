package com.vibeqwen.glasses.audio

import android.content.Context
import android.media.MediaMetadataRetriever
import androidx.core.content.FileProvider
import android.net.Uri
import android.os.Environment
import java.io.File
import java.io.RandomAccessFile

/**
 * 录音文件管理：输出目录、列表（时长/大小）、删除、分享 URI。
 *
 * 输出目录：<externalFilesDir>/Music/vibeQwenGlasses/（应用专属外部目录，
 * 免去 MANAGE_EXTERNAL_STORAGE/MediaStore 权限，分享经 FileProvider 授权）。
 */
object RecordingFileManager {

    const val AUTHORITY = "com.vibeqwen.glasses.fileprovider"

    data class RecordingInfo(
        val file: File,
        val displayName: String,
        val sizeBytes: Long,
        val durationMs: Long,
        val modifiedMs: Long,
    )

    fun recordingsDir(context: Context): File {
        val base = context.getExternalFilesDir(Environment.DIRECTORY_MUSIC) ?: context.filesDir
        return File(base, "vibeQwenGlasses").apply { mkdirs() }
    }

    /** 列出全部录音（wav / m4a），按修改时间倒序 */
    fun listRecordings(context: Context): List<RecordingInfo> {
        val dir = recordingsDir(context)
        val files = dir.listFiles { f -> f.isFile && (f.extension == "wav" || f.extension == "m4a") }
            ?.sortedByDescending { it.lastModified() }
            ?: emptyList()
        return files.map { f ->
            RecordingInfo(
                file = f,
                displayName = f.name,
                sizeBytes = f.length(),
                durationMs = durationOf(f),
                modifiedMs = f.lastModified(),
            )
        }
    }

    fun delete(file: File): Boolean = file.delete()

    /** 分享用 content URI（FileProvider 授权） */
    fun shareUri(context: Context, file: File): Uri =
        FileProvider.getUriForFile(context, AUTHORITY, file)

    fun mimeFor(file: File): String =
        when (file.extension.lowercase()) {
            "m4a" -> "audio/mp4"
            else -> "audio/wav"
        }

    // ── 时长 ──

    fun durationOf(file: File): Long =
        when (file.extension.lowercase()) {
            "wav" -> wavDurationMs(file)
            "m4a" -> mediaDurationMs(file)
            else -> 0L
        }

    /** 从 WAV 头解析时长（dataSize * 1000 / byteRate） */
    private fun wavDurationMs(file: File): Long {
        try {
            if (file.length() < 44) return 0L
            RandomAccessFile(file, "r").use { raf ->
                raf.seek(22)
                val channels = readShortLE(raf).toInt()
                val sampleRate = readIntLE(raf)
                val byteRate = readIntLE(raf)
                raf.seek(40)
                val dataSize = readIntLE(raf)
                if (sampleRate <= 0 || byteRate <= 0 || channels <= 0) return 0L
                return dataSize * 1000L / byteRate
            }
        } catch (e: Exception) {
            return 0L
        }
    }

    /** 用 MediaMetadataRetriever 读 m4a 时长 */
    private fun mediaDurationMs(file: File): Long {
        return try {
            val mmr = MediaMetadataRetriever()
            mmr.setDataSource(file.absolutePath)
            val d = mmr.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
            mmr.release()
            d
        } catch (e: Exception) {
            0L
        }
    }

    private fun readShortLE(raf: RandomAccessFile): Int {
        val lo = raf.read() and 0xFF
        val hi = raf.read() and 0xFF
        return lo or (hi shl 8)
    }

    private fun readIntLE(raf: RandomAccessFile): Long {
        val b0 = raf.read() and 0xFF
        val b1 = raf.read() and 0xFF
        val b2 = raf.read() and 0xFF
        val b3 = raf.read() and 0xFF
        return (b0.toLong() or (b1.toLong() shl 8) or (b2.toLong() shl 16) or (b3.toLong() shl 24))
    }
}
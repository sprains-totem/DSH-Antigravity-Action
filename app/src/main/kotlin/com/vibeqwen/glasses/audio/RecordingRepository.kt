package com.vibeqwen.glasses.audio

import com.vibeqwen.glasses.model.RecordingItem
import com.vibeqwen.glasses.protocol.QwenConstants
import java.io.File

/**
 * 录音文件仓储：扫描输出目录，构建 [RecordingItem] 列表（跨进程重启持久）。
 * WAV 时长可由文件字节数反推：dataBytes = size - 44，时长 = dataBytes/2/采样率。
 */
object RecordingRepository {

    fun list(dir: File): List<RecordingItem> {
        if (!dir.exists()) return emptyList()
        val files = dir.listFiles { f -> f.isFile && f.extension.equals("wav", ignoreCase = true) }
            ?: return emptyList()
        return files.mapNotNull { f ->
            if (f.length() <= 44) return@mapNotNull null
            val dataBytes = (f.length() - 44).coerceAtLeast(0)
            val durMs = dataBytes / 2 * 1000L / QwenConstants.SAMPLE_RATE
            RecordingItem(
                path = f.absolutePath,
                sliceIndex = 1,
                durationMs = durMs,
                sizeBytes = f.length(),
                createdAt = f.lastModified()
            )
        }.sortedByDescending { it.createdAt }
    }

    fun delete(path: String): Boolean = runCatching { File(path).delete() }.getOrDefault(false)
}

package com.vibeqwen.glasses.model

import java.io.File

/**
 * 一段录音（可能由多个 5 分钟切片组成，这里以单文件为单位展示）。
 */
data class RecordingItem(
    val path: String,
    val sliceIndex: Int,
    val durationMs: Long,
    val sizeBytes: Long,
    val createdAt: Long
) {
    val name: String get() = File(path).nameWithoutExtension
    val displayName: String get() = if (sliceIndex > 1) "${name} (#$sliceIndex)" else name
    val sizeKb: Int get() = (sizeBytes / 1024).toInt()
    val durationSec: Int get() = (durationMs / 1000).toInt()
}

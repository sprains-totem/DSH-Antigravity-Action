package com.vibeqwen.glasses.audio

import com.vibeqwen.glasses.model.RecordingItem
import com.vibeqwen.glasses.protocol.QwenConstants
import java.io.File

/**
 * 音频管线：把眼镜帧解析出的 PCM 写入 WAV，支持 5 分钟切片（参照 vibeARS 思路）。
 *
 * 输入点：来自 [com.vibeqwen.glasses.protocol.QwenFrameParser] 的 192 样本/帧 ShortArray
 * （替换 vibeARS 中 AudioRecord.read() 的位置）。输出：每片一个 .wav 文件。
 *
 * 内置「无数据 Watchdog」辅助：记录最近一帧时间，供上层检测断流。
 */
class AudioPipeline(private val outputDir: File) {

    data class Slice(
        val file: File,
        val index: Int,
        val frameCount: Long,
        val startedAt: Long
    )

    private var current: WavWriter? = null
    private var sliceStartedAt = 0L
    private var sliceIndex = 0
    private var recordingBaseName = ""
    private val slices = mutableListOf<Slice>()
    private var currentFrameCount = 0L
    private var lastFrameMs = 0L
    private var recording = false

    init {
        if (!outputDir.exists()) outputDir.mkdirs()
    }

    fun start(baseName: String) {
        recordingBaseName = baseName
        sliceIndex = 0
        slices.clear()
        currentFrameCount = 0
        recording = true
        openNextSlice()
    }

    private fun openNextSlice() {
        sliceIndex++
        val safe = recordingBaseName.replace(Regex("[^a-zA-Z0-9_\\-]"), "_")
        val file = File(outputDir, "${safe}_p${sliceIndex}.wav")
        current = WavWriter(file)
        sliceStartedAt = System.currentTimeMillis()
        currentFrameCount = 0
        lastFrameMs = System.currentTimeMillis()
        slices.add(Slice(file, sliceIndex, 0, sliceStartedAt))
    }

    /** 推入一帧（192 样本）PCM */
    fun pushFrame(samples: ShortArray) {
        val w = current ?: return
        w.writeSamples(samples)
        currentFrameCount++
        lastFrameMs = System.currentTimeMillis()
        // 5 分钟切片
        if (System.currentTimeMillis() - sliceStartedAt >= QwenConstants.SLICE_DURATION_MS) {
            closeCurrent()
            openNextSlice()
        }
    }

    private fun closeCurrent() {
        current?.close()
        if (slices.isNotEmpty()) {
            val last = slices.last()
            slices[slices.lastIndex] = last.copy(frameCount = currentFrameCount)
        }
        current = null
    }

    /** 停止录音，返回本次录音的切片列表（供列表/分享使用） */
    fun stop(): List<RecordingItem> {
        closeCurrent()
        recording = false
        return slices.map { s ->
            val durMs = s.frameCount * QwenConstants.AUDIO_SAMPLES_PER_FRAME * 1000L /
                QwenConstants.SAMPLE_RATE
            RecordingItem(
                path = s.file.absolutePath,
                sliceIndex = s.index,
                durationMs = durMs,
                sizeBytes = s.file.length(),
                createdAt = s.startedAt
            )
        }
    }

    /** 距最近一帧的毫秒数（无数据 Watchdog 用） */
    fun sinceLastFrameMs(): Long =
        if (!recording) 0 else System.currentTimeMillis() - lastFrameMs

    fun isRecording(): Boolean = recording
}

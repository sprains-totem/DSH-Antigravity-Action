package com.vibeqwen.glasses.audio

import kotlin.math.log10
import kotlin.math.sqrt
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 音频管线：PCM → WAV（可选 AAC/M4A），5 分钟切片，分贝/幅度计算，无数据 Watchdog。
 *
 * 参照 vibeARS 的 AudioPipeline 思路，输入点替换为眼镜 398B 帧解析出的 384B PCM 块：
 *   writeFrame(pcm) ← QwenFrameParser 输出
 * 输出目录：<externalFilesDir>/Music/vibeQwenGlasses/
 */
class AudioPipeline(
    private val outputDir: File,
    private val sliceSeconds: Long = 5 * 60L,
    private val aacEnabled: Boolean = false,
    private val aacBitrate: Int = 96_000,
    private val sampleRate: Int = 16000,
) {

    /** 一帧的幅度/分贝信息 */
    data class Level(val amplitude01: Float, val db: Float)

    /** 无数据告警回调（ms 为距最后数据的毫秒数） */
    var watchdogCallback: ((idleMs: Long) -> Unit)? = null

    /** 幅度回调（内部已限流 ~20Hz） */
    var levelCallback: ((Level) -> Unit)? = null

    /** 切片回滚回调（切片闭合时通知，可用于 UI 计数） */
    var sliceCallback: ((index: Int, file: File) -> Unit)? = null

    @Volatile
    var recording = false
        private set

    /** 最后收到数据的毫秒时间戳 */
    @Volatile
    var lastDataMs: Long = 0L
        private set

    private var currentWriter: WavWriter? = null
    private var currentAac: AacEncoder? = null
    private var currentM4aFile: File? = null
    private var sliceIndex = 0
    private var sliceStartMs = 0L
    private var totalPcmBytes = 0L
    private var baseName = ""
    private var lastLevelEmitMs = 0L
    private var watchdogThread: Thread? = null

    companion object {
        /** 无数据看门狗阈值：超过该时长未收到任何帧则告警 */
        const val MAX_SILENCE_MS = 15_000L
        const val WATCHDOG_INTERVAL_MS = 2_000L
        private const val LEVEL_THROTTLE_MS = 50L
    }

    /** 开始录音（可指定起始时间戳用于命名） */
    fun start(startMs: Long = System.currentTimeMillis()) {
        recording = true
        sliceIndex = 0
        totalPcmBytes = 0
        lastDataMs = startMs
        baseName = "rec_" + SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date(startMs))
        openNextSlice(startMs)
        startWatchdog()
    }

    /** 写入一帧 PCM（384B，16bit LE 单声道） */
    fun writeFrame(pcm: ByteArray) {
        if (!recording) return
        val writer = currentWriter ?: return
        val now = System.currentTimeMillis()

        writer.write(pcm)
        currentAac?.write(pcm)
        totalPcmBytes += pcm.size
        lastDataMs = now

        // 分贝/幅度（限流避免高频回调）
        if (now - lastLevelEmitMs >= LEVEL_THROTTLE_MS) {
            lastLevelEmitMs = now
            levelCallback?.invoke(computeLevel(pcm))
        }

        // 5 分钟切片（按墙钟时间滚动）
        if (now - sliceStartMs >= sliceSeconds * 1000) {
            closeCurrentSlice()
            openNextSlice(now)
        }
    }

    /** 停止录音：封口当前切片并释放资源 */
    fun stop() {
        recording = false
        watchdogThread?.interrupt()
        watchdogThread = null
        closeCurrentSlice()
    }

    /** 当前会话累计采集字节数 */
    fun totalBytes(): Long = totalPcmBytes

    /** 当前录音时长（毫秒，估算） */
    fun elapsedMs(): Long = if (recording) System.currentTimeMillis() - sliceStartMs + sliceIndex * sliceSeconds * 1000 else 0L

    // ── 内部 ──

    private fun openNextSlice(atMs: Long) {
        sliceStartMs = atMs
        if (!outputDir.exists()) outputDir.mkdirs()
        val wavFile = File(outputDir, sliceFileName("wav"))
        com.vibeqwen.glasses.util.LogCollector.r("创建切片音频文件: ${wavFile.absolutePath}")
        currentWriter = WavWriter(wavFile)
        if (aacEnabled) {
            val m4aFile = File(outputDir, sliceFileName("m4a"))
            currentM4aFile = m4aFile
            currentAac = try {
                AacEncoder(m4aFile, sampleRate, 1, aacBitrate)
            } catch (e: Exception) {
                currentM4aFile = null
                null
            }
        }
        sliceCallback?.invoke(sliceIndex, wavFile)
    }

    private fun closeCurrentSlice() {
        currentWriter?.close()
        currentWriter = null
        currentAac?.finish()
        currentAac = null
        currentM4aFile = null
        sliceIndex++
    }

    private fun sliceFileName(ext: String): String =
        if (sliceIndex == 0) "$baseName.$ext" else "${baseName}_$sliceIndex.$ext"

    private fun startWatchdog() {
        watchdogThread = Thread({
            try {
                while (recording) {
                    val idleMs = System.currentTimeMillis() - lastDataMs
                    if (idleMs >= MAX_SILENCE_MS) {
                        watchdogCallback?.invoke(idleMs)
                    }
                    Thread.sleep(WATCHDOG_INTERVAL_MS)
                }
            } catch (e: InterruptedException) {
                // 正常退出
            }
        }, "vqg-audio-watchdog").apply {
            isDaemon = true
            start()
        }
    }

    private fun computeLevel(pcm: ByteArray): Level {
        var sumSq = 0.0
        var samples = 0
        var i = 0
        while (i + 1 < pcm.size) {
            val lo = pcm[i].toInt() and 0xFF
            val hi = pcm[i + 1].toInt()
            val sample = (lo or (hi shl 8)).toShort().toInt()
            sumSq += sample.toDouble() * sample
            samples++
            i += 2
        }
        if (samples == 0) return Level(0f, -100f)
        val rms = sqrt(sumSq / samples)
        val amp = (rms / 32768.0).coerceIn(0.0, 1.0).toFloat()
        val db = if (rms <= 0.0) -100.0 else (20.0 * log10(rms / 32768.0)).coerceAtLeast(-100.0)
        return Level(amp, db.toFloat())
    }
}
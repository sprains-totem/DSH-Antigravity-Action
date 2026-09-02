package com.vibeqwen.glasses.ui.player

import android.media.AudioAttributes
import android.media.MediaPlayer
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vibeqwen.glasses.audio.RecordingFileManager.RecordingInfo
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch
import java.io.File
import java.io.RandomAccessFile
import kotlin.math.abs

/**
 * 播放器 ViewModel：MediaPlayer 封装 + 变速 / 循环 / 跳转 / 波形峰值。
 */
class PlayerViewModel(private val info: RecordingInfo) : ViewModel() {

    data class PlayerUiState(
        val isPlaying: Boolean = false,
        val positionMs: Long = 0,
        val durationMs: Long = 0,
        val speed: Float = 1f,
        val loop: Boolean = false,
        val peaks: FloatArray = FloatArray(0),
        val error: String? = null,
    )

    private val _ui = MutableStateFlow(PlayerUiState())
    val ui: StateFlow<PlayerUiState> = _ui.asStateFlow()

    private var player: MediaPlayer? = null
    private var progressJob: Job? = null

    init {
        prepare()
    }

    private fun prepare() {
        _ui.update { it.copy(peaks = computePeaks(info.file, 200)) }
        player = try {
            MediaPlayer().apply {
                setDataSource(info.file.absolutePath)
                setAudioAttributes(
                    AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_MEDIA)
                        .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                        .build()
                )
                prepare()
                isLooping = false
            }
        } catch (e: Exception) {
            _ui.update { it.copy(error = "无法播放：${e.message}") }
            null
        }
        _ui.update { it.copy(durationMs = player?.duration?.toLong() ?: 0L) }
        startProgress()
    }

    fun playPause() {
        val p = player ?: return
        if (p.isPlaying) {
            p.pause()
            _ui.update { it.copy(isPlaying = false) }
        } else {
            p.start()
            _ui.update { it.copy(isPlaying = true) }
        }
    }

    fun seekTo(ms: Long) {
        val p = player ?: return
        val clamped = ms.coerceIn(0L, p.duration.coerceAtLeast(0).toLong())
        p.seekTo(clamped.toInt())
        _ui.update { it.copy(positionMs = clamped) }
    }

    /** ±10s 跳转 */
    fun skip(deltaMs: Long) {
        val p = player ?: return
        seekTo(p.currentPosition.toLong() + deltaMs)
    }

    fun toggleLoop() {
        val next = !_ui.value.loop
        player?.isLooping = next
        _ui.update { it.copy(loop = next) }
    }

    /** 变速 0.5x ~ 2.0x（PlaybackParams，API 23+） */
    fun setSpeed(speed: Float) {
        val p = player ?: return
        try {
            p.playbackParams = p.playbackParams.setSpeed(speed)
            _ui.update { it.copy(speed = speed) }
        } catch (e: Exception) {
            _ui.update { it.copy(error = "变速失败：${e.message}") }
        }
    }

    private fun startProgress() {
        progressJob?.cancel()
        progressJob = viewModelScope.launch {
            while (isActive) {
                val p = player ?: break
                val dur = _ui.value.durationMs
                if (p.isPlaying) {
                    _ui.update { it.copy(positionMs = p.currentPosition.toLong()) }
                } else if (dur > 0 && !p.isLooping && p.currentPosition >= p.duration - 300) {
                    // 播放到末尾自动停下
                    _ui.update { it.copy(isPlaying = false) }
                }
                delay(300)
            }
        }
    }

    override fun onCleared() {
        progressJob?.cancel()
        player?.release()
        player = null
    }

    /** 从 WAV 读 PCM 计算峰值（M4A 返回空数组，仅显示进度条） */
    private fun computePeaks(file: File, target: Int): FloatArray {
        if (file.extension.lowercase() != "wav") return FloatArray(0)
        if (file.length() < 44) return FloatArray(0)
        val size = file.length().toInt()
        val toRead = minOf(size - 44, 2 * 1024 * 1024)
        val data = ByteArray(toRead)
        try {
            RandomAccessFile(file, "r").use { raf ->
                raf.seek(44)
                raf.readFully(data)
            }
        } catch (e: Exception) {
            return FloatArray(0)
        }
        val perBucket = ((data.size / 2) / target).coerceAtLeast(1)
        val peaks = FloatArray(target)
        var bucket = 0
        var count = 0
        var maxAbs = 0
        var i = 0
        while (i + 1 < data.size && bucket < target) {
            val lo = data[i].toInt() and 0xFF
            val hi = data[i + 1].toInt()
            val s = (lo or (hi shl 8)).toShort().toInt()
            val a = abs(s)
            if (a > maxAbs) maxAbs = a
            count++
            if (count >= perBucket) {
                peaks[bucket++] = maxAbs / 32768f
                maxAbs = 0
                count = 0
            }
            i += 2
        }
        return peaks
    }
}
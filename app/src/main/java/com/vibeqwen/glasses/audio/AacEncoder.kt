package com.vibeqwen.glasses.audio

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import java.io.File

/**
 * AAC-LC 编码 + MPEG-4(M4A) 封装（可选编码路径，默认 WAV）。
 *
 * 把 16bit LE / 16000Hz / 单声道 PCM 编码为 AAC 并写入 .m4a。
 * 基于 MediaCodec 同步模式：写输入缓冲 + drain 输出缓冲。
 */
class AacEncoder(
    file: File,
    private val sampleRate: Int = 16000,
    private val channels: Int = 1,
    private val bitRate: Int = 96_000,
) {
    private val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_AUDIO_AAC)
    private val muxer = MediaMuxer(file.absolutePath, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
    private val info = MediaCodec.BufferInfo()
    private val timeoutUs = 10_000L

    private var trackIndex = -1
    private var muxerStarted = false
    private var inputPtsUs = 0L

    init {
        val format = MediaFormat.createAudioFormat(MediaFormat.MIMETYPE_AUDIO_AAC, sampleRate, channels).apply {
            setInteger(MediaFormat.KEY_AAC_PROFILE, MediaCodecInfo.CodecProfileLevel.AACObjectLC)
            setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
            setInteger(MediaFormat.KEY_MAX_INPUT_SIZE, 2048)
        }
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        codec.start()
    }

    /** 写入 PCM 帧（16bit LE 单声道） */
    fun write(pcm: ByteArray) {
        var offset = 0
        while (offset < pcm.size) {
            val inIdx = codec.dequeueInputBuffer(timeoutUs)
            if (inIdx < 0) {
                drain(false)
                continue
            }
            val inBuf = codec.getInputBuffer(inIdx) ?: continue
            inBuf.clear()
            val remaining = pcm.size - offset
            val toWrite = minOf(remaining, inBuf.remaining())
            inBuf.put(pcm, offset, toWrite)
            codec.queueInputBuffer(inIdx, 0, toWrite, inputPtsUs, 0)
            inputPtsUs += toWrite * 1_000_000L / (sampleRate * channels * 2)
            offset += toWrite
        }
        drain(false)
    }

    /** 结束编码并封装 */
    fun finish() {
        val inIdx = codec.dequeueInputBuffer(timeoutUs)
        if (inIdx >= 0) {
            codec.queueInputBuffer(inIdx, 0, 0, inputPtsUs, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
        }
        drain(true)
        try {
            codec.stop()
        } catch (e: Exception) {
            // 已结束
        }
        codec.release()
        try {
            if (muxerStarted) muxer.stop()
        } catch (e: Exception) {
            // 无有效轨道时忽略
        }
        muxer.release()
    }

    private fun drain(endOfStream: Boolean) {
        while (true) {
            val outIdx = codec.dequeueOutputBuffer(info, timeoutUs)
            when {
                outIdx == MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                    trackIndex = muxer.addTrack(codec.outputFormat)
                    muxer.start()
                    muxerStarted = true
                }
                outIdx >= 0 -> {
                    val outBuf = codec.getOutputBuffer(outIdx)
                    if (outBuf != null && info.size > 0 && (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG) == 0) {
                        outBuf.position(info.offset)
                        outBuf.limit(info.offset + info.size)
                        if (muxerStarted) {
                            muxer.writeSampleData(trackIndex, outBuf, info)
                        }
                    }
                    codec.releaseOutputBuffer(outIdx, false)
                    if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) return
                }
                else -> {
                    // INFO_TRY_AGAIN_LATER 等
                    if (!endOfStream) return
                    // endOfStream 模式下等待剩余缓冲
                    if (outIdx == MediaCodec.INFO_TRY_AGAIN_LATER) return
                }
            }
        }
    }
}
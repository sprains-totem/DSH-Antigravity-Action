package com.vibeqwen.glasses.protocol

import org.json.JSONObject
import kotlin.random.Random

/**
 * 指令构造器：把业务动作翻译成眼镜协议 JSON 文本。
 * 所有 JSON 通过 [toText] 序列化为 UTF-8 字符串后由传输层下发（CID 0x004A）。
 *
 * 字段生成规则严格遵循 PROTOCOL.md §4.3：
 *  - sessionId：毫秒时间戳前 10 位（= millis/1000）
 *  - taskLinkId："AudioRecording" + 毫秒时间戳 + 32 位大写 HEX
 *  - wakeupType：longRecord
 *  - reason：touch
 */
object QwenCommands {

    private const val HEX = "0123456789ABCDEF"

    /** 生成 32 位大写 HEX（用于 taskLinkId 后缀） */
    private fun randomHex32(): String {
        val r = Random.Default
        val sb = StringBuilder(32)
        repeat(32) { sb.append(HEX[r.nextInt(16)]) }
        return sb.toString()
    }

    /** 当前毫秒时间戳前 10 位，作为会话 id */
    fun newSessionId(): String = (System.currentTimeMillis() / 1000).toString()

    /**
     * 开始录音指令：返回需依次下发的 3 条 JSON 文本（PROTOCOL.md §4.1）。
     * 顺序：code:AudioRecording → wakeupType:longRecord → uri:airecord://start
     */
    fun buildStartRecord(): List<String> {
        val ts = System.currentTimeMillis()
        val sessionId = (ts / 1000).toString()
        val taskLinkId = "AudioRecording$ts${randomHex32()}"

        val msg1 = JSONObject().apply {
            put("code", QwenConstants.CODE_AUDIO_RECORDING)
            put("data", JSONObject().put("reason", QwenConstants.REASON_TOUCH))
            put(
                "extensions",
                JSONObject().put("taskLinkId", taskLinkId).put("bizType", "live")
            )
            put("sessionId", sessionId)
        }

        val msg2 = JSONObject().apply {
            put("data", JSONObject().put("reason", QwenConstants.REASON_TOUCH))
            put("scene", QwenConstants.CODE_AUDIO_RECORDING)
            put("sessionId", sessionId)
            put("taskLinkId", taskLinkId)
            put("wakeupType", QwenConstants.WAKEUP_TYPE_LONG_RECORD)
        }

        val msg3 = JSONObject().apply {
            put("data", JSONObject().put("reason", QwenConstants.REASON_TOUCH))
            put("pageType", "SCHEME_AIRECORD_START")
            put("sessionId", sessionId)
            put("uri", QwenConstants.URI_AI_RECORD_START)
        }

        return listOf(msg1.toString(), msg2.toString(), msg3.toString())
    }

    /**
     * 停止录音指令：返回需依次下发的 2 条 JSON 文本（PROTOCOL.md §4.2）。
     */
    fun buildStopRecord(): List<String> {
        val msg1 = JSONObject().apply {
            put("type", "PART")
            put("codeList", org.json.JSONArray().apply { put(QwenConstants.CODE_AUDIO_RECORDING) })
        }
        val msg2 = JSONObject().apply {
            put("code", QwenConstants.CODE_AUDIO_RECORDING)
        }
        return listOf(msg1.toString(), msg2.toString())
    }

    /** 把 JSONObject 转为下发文本 */
    fun toText(obj: JSONObject): String = obj.toString()
}

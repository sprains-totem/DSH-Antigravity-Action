package com.vibeqwen.glasses.protocol

import org.json.JSONException
import org.json.JSONObject

/**
 * 眼镜事件解析（CID 0x0041 → 手机 JSON）。
 *
 * 解析内容（来源 PROTOCOL.md §4.4、§6）：
 *  - record_start / record_end（power-state 事件）
 *  - AudioRecording 任务状态（Running/TryExit/Exiting/Exited）
 *  - 心跳 / 遥测（用于连接活性检测）
 *
 * 设计为纯函数 + 数据类，便于单元测试。
 */
sealed interface QwenEvent {

    /** 录音开始（眼镜侧音频流已开启） */
    data class RecordStart(val battery: Int?, val startTime: Long?) : QwenEvent

    /** 录音结束 */
    data class RecordEnd(
        val battery: Int?,
        val endTime: Long?,
        val durationMs: Long?
    ) : QwenEvent

    /** AudioRecording 任务状态变化 */
    data class TaskState(
        val status: String?,
        val reason: String?,
        val reasonStop: String?
    ) : QwenEvent

    /** 握手：眼镜上报 active_data / odm（会话令牌） */
    data class ActiveData(val activeData: String?, val odm: String?) : QwenEvent

    /** 握手：眼镜上报 pairAdv / pid / peerAddr（连接参数） */
    data class PairInfo(val pid: Int?, val peerAddr: String?) : QwenEvent

    /** 握手：眼镜上报 type:10001（连接状态通知） */
    data class Type10001Q(val arg1: Int?, val arg2: Int?) : QwenEvent

    /** 握手：attach_success（绑定完成确认） */
    data class AttachSuccess(val code: Int?, val msg: String?) : QwenEvent

    /** 其他（心跳 / 同步 / 遥测），仅透传原始 JSON 文本 */
    data class Other(val raw: String) : QwenEvent
}

object QwenEvents {

    /**
     * 解析一行 JSON 文本。
     * @return 解析出的事件；若不是可识别事件返回 [QwenEvent.Other]；
     *         若 JSON 非法返回 null（调用方应忽略）。
     */
    fun parse(jsonText: String): QwenEvent? {
        val text = jsonText.trim()
        if (text.isEmpty()) return null
        val obj: JSONObject = try {
            JSONObject(text)
        } catch (e: JSONException) {
            return null
        }

        // 1) power-state 事件（record_start / record_end）
        if (obj.optString("eventType", "").equals("power-state", ignoreCase = true)) {
            val name = obj.optString("eventName", "")
            val ctx = obj.optJSONObject("contextInfo")
            return when {
                name.startsWith("record_start", ignoreCase = true) -> QwenEvent.RecordStart(
                    battery = ctx?.optInt("battery", -1)?.takeIf { it >= 0 },
                    startTime = ctx?.optLong("startTime", -1L)?.takeIf { it >= 0 }
                )
                name.startsWith("record_end", ignoreCase = true) -> QwenEvent.RecordEnd(
                    battery = ctx?.optInt("battery", -1)?.takeIf { it >= 0 },
                    endTime = ctx?.optLong("endTime", -1L)?.takeIf { it >= 0 },
                    durationMs = ctx?.optLong("duration", -1L)?.takeIf { it >= 0 }
                )
                else -> QwenEvent.Other(text)
            }
        }

        // 2) AudioRecording 任务状态变化
        if (obj.has("code") && obj.optString("code", "") == QwenConstants.CODE_AUDIO_RECORDING
            && obj.has("status")
        ) {
            return QwenEvent.TaskState(
                status = obj.optString("status", null),
                reason = obj.optString("reason", null),
                reasonStop = obj.optString("reasonStop", null)
            )
        }

        // 3) 心跳（含 log_timestamp 或 system heartbeat 标记）
        val hasHeartbeat = obj.has("log_timestamp") || obj.optString("eventName", "")
            .equals("system heartbeat", ignoreCase = true)
        if (hasHeartbeat) {
            return QwenEvent.Other(text)
        }

        // 4) 握手事件（来源 PROTOCOL.md §3：眼镜主动上报）
        //    active_data / odm：会话令牌上报
        if (obj.has("active_data")) {
            return QwenEvent.ActiveData(
                activeData = obj.optString("active_data", null),
                odm = obj.optString("odm", null)
            )
        }
        //    pairAdv / pid / peerAddr：连接参数上报
        if (obj.has("pairAdv") || obj.has("pid")) {
            return QwenEvent.PairInfo(
                pid = obj.optInt("pid", -1).takeIf { it >= 0 },
                peerAddr = obj.optString("peerAddr", null)
            )
        }
        //    type:10001：连接状态通知（注意与请求同构，arg1/arg2 一致）
        if (obj.optInt("type", -1) == 10001) {
            return QwenEvent.Type10001Q(
                arg1 = obj.optInt("arg1", -1).takeIf { it >= 0 },
                arg2 = obj.optInt("arg2", -1).takeIf { it >= 0 }
            )
        }
        //    attach_success：绑定完成确认
        if (obj.optString("msg", "").contains("attach_success") || obj.has("attach_success")) {
            return QwenEvent.AttachSuccess(
                code = obj.optInt("code", -1).takeIf { it >= 0 },
                msg = obj.optString("msg", null)
            )
        }

        return QwenEvent.Other(text)
    }

    /** 是否为录音开始事件（用于驱动 UI 状态） */
    fun isRecordStart(ev: QwenEvent): Boolean = ev is QwenEvent.RecordStart

    /** 是否为录音结束事件 */
    fun isRecordEnd(ev: QwenEvent): Boolean = ev is QwenEvent.RecordEnd
}

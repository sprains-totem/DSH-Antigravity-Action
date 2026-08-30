package com.vibeqwen.glasses.protocol

import org.json.JSONObject
import kotlin.random.Random

/**
 * 握手状态机（连接建立 → READY）。
 *
 * 依据 docs/PROTOCOL.md §3 + §3.2 简化握手建议：眼镜会**主动上报**
 * active_data/pid/type:10001，客户端只需按序下发固定格式 JSON 即可进入 READY，
 * 无需预先计算令牌。
 *
 * 本实现为「脚本式下发 + 状态广播」：
 *  - 连接后按协议时序逐条下发手机→眼镜消息；
 *  - 同时监听眼镜回包（由 [onIncoming] 喂入）以提前确认 READY；
 *  - 若未收到确认，脚本在发完 attach_success 并短暂等待后也判定 READY（兼容无回显固件）。
 */
enum class HandshakeState {
    IDLE,
    SENDING_HELLO,     // 发 device/[]、calendarSync、messageId
    NEGOTIATING,       // type:10001 镜像、sessionId、support
    AUTHING,           // type:1103 SN 认证 + attach_success
    READY,             // 可录音
    FAILED
}

class HandshakeException(message: String) : Exception(message)

object QwenHandshake {

    /** 当前状态（供 UI 展示） */
    @Volatile
    var state: HandshakeState = HandshakeState.IDLE
        private set

    fun reset() {
        state = HandshakeState.IDLE
    }

    private fun setState(s: HandshakeState) {
        state = s
    }

    /**
     * 运行握手。
     * @param write 下发一行 JSON 文本（CID 0x004A）
     * @param onState 状态变化回调
     * @param delayMs 每条消息之间的间隔（默认 90ms，约等于真机节奏）
     */
    suspend fun run(
        write: suspend (String) -> Unit,
        onState: (HandshakeState) -> Unit,
        delayMs: Long = 90L
    ) {
        setState(HandshakeState.SENDING_HELLO)
        onState(state)

        // —— 阶段 1：问候（PROTOCOL.md §3 时序 3676~3738ms）——
        write(JSONObject().put("device", org.json.JSONArray()).toString())           // {"device":[]}
        kotlinx.coroutines.delay(delayMs)
        write(JSONObject().put("device", org.json.JSONArray()).toString())           // {"device":[]}
        kotlinx.coroutines.delay(delayMs)
        write(JSONObject().toString())                                               // {}
        kotlinx.coroutines.delay(delayMs)
        write(
            JSONObject().put(
                "device",
                org.json.JSONArray().put(
                    JSONObject()
                        .put("identifier", "calendarSync")
                        .put(
                            "value",
                            "{\"calendarSyncEnable\":false,\"notificationSyncEnable\":false,\"scheduleEnable\":false}"
                        )
                )
            ).toString()
        )
        kotlinx.coroutines.delay(delayMs)
        write(
            JSONObject()
                .put("messageId", System.currentTimeMillis().toString())
                .put("phoneType", QwenConstants.PHONE_TYPE)
                .put("supportHeicDecode", QwenConstants.SUPPORT_HEIC_DECODE)
                .toString()
        )

        // —— 阶段 2：协商（4911~4914ms）——
        setState(HandshakeState.NEGOTIATING)
        onState(state)
        kotlinx.coroutines.delay(delayMs)
        write(JSONObject().put("type", 10001).put("arg1", 1).put("arg2", 1).toString()) // type:10001 镜像
        kotlinx.coroutines.delay(delayMs)
        val sessionId = Random.nextInt(1, Int.MAX_VALUE)
        write(JSONObject().put("sessionId", sessionId).toString())
        kotlinx.coroutines.delay(delayMs)
        write(JSONObject().put("support", true).toString())

        // —— 阶段 3：SN 认证 + attach_success（6457~6462ms）——
        setState(HandshakeState.AUTHING)
        onState(state)
        kotlinx.coroutines.delay(delayMs)
        write(
            JSONObject()
                .put("type", 1103)
                .put("arg1", 1)
                .put("arg2", 0)
                .put("data", QwenConstants.DEVICE_SN)
                .toString()
        )
        kotlinx.coroutines.delay(delayMs)
        write(JSONObject().put("code", 1).put("msg", "attach_success").toString())
        kotlinx.coroutines.delay(delayMs)

        // 广播本端支持的录音能力（帮助眼镜确认 AudioRecording 特性）
        write(
            JSONObject().put(
                "feature",
                JSONObject().put(
                    "app",
                    org.json.JSONArray().put(
                        JSONObject().put("i", "AudioRecording").put("m", "2.0").put("v", "2.0")
                    )
                )
            ).toString()
        )
        kotlinx.coroutines.delay(300)

        setState(HandshakeState.READY)
        onState(state)
    }

    /**
     * 喂入眼镜回包 JSON，用于在收到确认时提前进入 READY（可选加速）。
     * 当前脚本式握手不依赖此回调，但保留以便后续精确化。
     */
    fun onIncoming(jsonText: String) {
        if (state == HandshakeState.READY || state == HandshakeState.FAILED) return
        // 若眼镜回显 attach_success 或 feature，则直接进入 READY
        if (jsonText.contains("attach_success") || jsonText.contains("\"code\":1")) {
            setState(HandshakeState.READY)
        }
    }
}

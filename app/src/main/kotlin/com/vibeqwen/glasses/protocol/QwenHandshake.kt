package com.vibeqwen.glasses.protocol

import kotlinx.coroutines.CompletableDeferred
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeoutOrNull
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.atomic.AtomicLong

/**
 * 握手状态机（连接建立 → READY）。
 *
 * 依据 docs/PROTOCOL.md §3 时序（已由抓包逐条验证）：
 *   手机 → {"device":[]} ×2 / {} / calendarSync / messageId+phoneType:1+supportHeicDecode:1
 *   眼镜 → active_data+odm / pairAdv+pid+peerAddr / {"type":10001}
 *   手机 → {"type":10001} 同构 / sessionId / support:true / {"type":1103,data=SN}
 *   眼镜 → attach_success（code:1）→ READY
 *
 * 关键设计（与抓包行为一致）：
 *  - active_data 是眼镜**主动上报**的令牌，客户端无需回传；
 *  - 每条眼镜确认事件由 [onIncoming] 异步喂入，用 CompletableDeferred 门闩驱动
 *    状态推进，而不是固定时序盲发；
 *  - 宽容超时：个别固件可能不上报 active_data 或 attach_success，超时后仍进入
 *    READY（tolerate 开关），避免在未确认时卡死。
 */
enum class HandshakeState {
    IDLE,
    DEVICE_QUERY,      // 发 device/[]、calendarSync、messageId
    WAIT_GLASSES_INFO, // 等眼镜 active_data/pairAdv/type:10001
    AUTH_SESSION,      // type:10001 镜像、sessionId、support
    SN_AUTH,           // type:1103 SN 认证
    WAIT_ATTACH,       // 等 attach_success
    READY,             // 可录音
    FAILED
}

class HandshakeException(message: String) : Exception(message)

/**
 * 握手状态机实例。每个连接创建一个实例，避免跨连接状态串扰。
 */
class QwenHandshake(
    /** 宽容模式：超时未收到 attach_success 仍置 READY（默认 true，给固件差异留余地） */
    private val tolerateAttachTimeout: Boolean = true,
    /** 等待眼镜信息上报超时（ms） */
    private val infoTimeoutMs: Long = 3000L,
    /** 等待 attach_success 超时（ms） */
    private val attachTimeoutMs: Long = 3000L,
) {
    @Volatile
    var state: HandshakeState = HandshakeState.IDLE
        private set

    /** 会话号（沿用抓包观测量级的起始值） */
    private val sessionCounter = AtomicLong(4196571L)

    /** 每步发送间隔（ms），贴合真机节奏 */
    private val stepDelayMs: Long = 90L

    private var infoGate: CompletableDeferred<Unit>? = null
    private var attachGate: CompletableDeferred<Unit>? = null

    private fun setState(s: HandshakeState) {
        state = s
    }

    /**
     * 运行握手（挂起直到 READY 或 FAILED）。
     * @param write 下发一行 JSON 文本（CID 0x004A）
     * @param onState 状态变化回调（UI）
     */
    suspend fun run(
        write: suspend (String) -> Unit,
        onState: (HandshakeState) -> Unit
    ) {
        // 阶段 1：设备查询 + 问候（PROTOCOL.md §3 时序 3676~3738ms）
        setState(HandshakeState.DEVICE_QUERY)
        onState(state)
        val empty = JSONArray()
        write(JSONObject().put("device", empty).toString())                    // {"device":[]}
        delay(stepDelayMs)
        write(JSONObject().put("device", empty).toString())                    // {"device":[]}
        delay(stepDelayMs)
        write(JSONObject().toString())                                         // {}
        delay(stepDelayMs)
        write(
            JSONObject().put(
                "device",
                JSONArray().put(
                    JSONObject()
                        .put("identifier", "calendarSync")
                        .put(
                            "value",
                            "{\"calendarSyncEnable\":false,\"notificationSyncEnable\":false,\"scheduleEnable\":false}"
                        )
                )
            ).toString()
        )
        delay(stepDelayMs)
        write(
            JSONObject()
                .put("messageId", System.currentTimeMillis().toString())
                .put("phoneType", QwenConstants.PHONE_TYPE)
                .put("supportHeicDecode", QwenConstants.SUPPORT_HEIC_DECODE)
                .toString()
        )

        // 阶段 2：等待眼镜上报 active_data / pairAdv / type:10001（任一种即满足）
        setState(HandshakeState.WAIT_GLASSES_INFO)
        onState(state)
        infoGate = CompletableDeferred()
        withTimeoutOrNull(infoTimeoutMs) { infoGate?.await() }

        // 阶段 3：认证会话（抓包 4911~4914ms）
        setState(HandshakeState.AUTH_SESSION)
        onState(state)
        delay(stepDelayMs)
        write(JSONObject().put("type", 10001).put("arg1", 1).put("arg2", 1).toString())
        delay(stepDelayMs)
        write(JSONObject().put("sessionId", sessionCounter.incrementAndGet()).toString())
        delay(stepDelayMs)
        write(JSONObject().put("support", true).toString())

        // 阶段 4：SN 认证（抓包 6457ms）
        setState(HandshakeState.SN_AUTH)
        onState(state)
        delay(stepDelayMs)
        write(
            JSONObject()
                .put("type", 1103)
                .put("arg1", 1)
                .put("arg2", 0)
                .put("data", QwenConstants.DEVICE_SN)
                .toString()
        )

        // 阶段 5：等待 attach_success（抓包 6461ms）
        setState(HandshakeState.WAIT_ATTACH)
        onState(state)
        attachGate = CompletableDeferred()
        val attached =
            withTimeoutOrNull(attachTimeoutMs) { attachGate?.await() } != null

        if (attached || tolerateAttachTimeout) {
            setState(HandshakeState.READY)
            onState(state)
        } else {
            setState(HandshakeState.FAILED)
            onState(state)
            throw HandshakeException("未收到 attach_success，眼镜拒绝本次连接")
        }
    }

    /**
     * 喂入眼镜下行事件（控制通道每条 JSON 文本）。
     * 由连接层在收到眼镜回包时调用，驱动握手门闩推进。
     */
    fun onIncoming(jsonText: String) {
        if (state == HandshakeState.READY || state == HandshakeState.FAILED) return
        val ev = QwenEvents.parse(jsonText) ?: return
        when (ev) {
            is QwenEvent.ActiveData, is QwenEvent.PairInfo, is QwenEvent.Type10001Q -> {
                infoGate?.let { if (!it.isCompleted) it.complete(Unit) }
            }
            is QwenEvent.AttachSuccess -> {
                attachGate?.let { if (!it.isCompleted) it.complete(Unit) }
            }
            else -> Unit
        }
    }
}
package com.vibeqwen.glasses.protocol

import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 握手状态机单元测试：验证回包驱动（门闩推进）逻辑正确。
 * 关键：用协程 delay 轮询（不能 Thread.sleep，否则阻塞 runBlocking 调度器，
 * async 握手协程无法推进，门闩永不解除）。喂包要等对应 gate 已创建。
 */
class QwenHandshakeTest {

    @Test
    fun `握手在收到眼镜回包后进入 READY`() = runBlocking {
        QwenHandshake.reset()
        val sent = mutableListOf<String>()
        val states = mutableListOf<HandshakeState>()

        val job = async {
            runCatching {
                QwenHandshake.run(
                    write = { sent.add(it) },
                    onState = { states.add(it) }
                )
            }
        }

        // 等 run() 进入 WAIT_GLASSES_INFO（infoGate 已创建）
        awaitState(HandshakeState.WAIT_GLASSES_INFO)

        // 眼镜回包序列
        QwenHandshake.onIncoming("""{"active_data":"656D4B74446A","odm":"AILABS_SG02_QW"}""")
        QwenHandshake.onIncoming("""{"pairAdv":false,"pid":8665,"peerAddr":"22:c1:37:10:6e:b4"}""")
        QwenHandshake.onIncoming("""{"type":10001,"arg1":1,"arg2":1}""")

        // 等进入 WAIT_ATTACH（attachGate 已创建）再喂 attach_success
        awaitState(HandshakeState.WAIT_ATTACH)
        QwenHandshake.onIncoming("""{"code":1,"msg":"attach_success"}""")

        val result = kotlinx.coroutines.withTimeoutOrNull(5000) { job.await(); "done" }
        assertEquals("done", result)
        assertEquals(HandshakeState.READY, QwenHandshake.state)
        assertTrue(states.contains(HandshakeState.WAIT_GLASSES_INFO))
        assertTrue(states.contains(HandshakeState.WAIT_ATTACH))
        assertTrue(states.contains(HandshakeState.READY))
        // 验证消息序列关键要素
        assertTrue(sent.any { it.contains("\"device\":[]") })
        assertTrue(sent.any { it.contains("calendarSync") })
        assertTrue(sent.any { it.contains("phoneType") })
        assertTrue(sent.any { it.contains("\"support\":true") })
        assertTrue(sent.any { it.contains("\"type\":1103") })
    }

    @Test
    fun `仅喂 active_data 也能推进到后续阶段`() = runBlocking {
        QwenHandshake.reset()
        val sent = mutableListOf<String>()

        val job = async {
            runCatching {
                QwenHandshake.run(
                    write = { sent.add(it) },
                    onState = {}
                )
            }
        }

        awaitState(HandshakeState.WAIT_GLASSES_INFO)
        QwenHandshake.onIncoming("""{"active_data":"AAA","odm":"AILABS_SG02_QW"}""")

        awaitState(HandshakeState.WAIT_ATTACH)
        QwenHandshake.onIncoming("""{"code":1,"msg":"attach_success"}""")

        val result = kotlinx.coroutines.withTimeoutOrNull(5000) { job.await(); "done" }
        assertEquals("done", result)
        assertEquals(HandshakeState.READY, QwenHandshake.state)
    }

    @Test
    fun `事件解析识别握手字段`() {
        // active_data
        val ev1 = QwenEvents.parse("""{"reset":false,"active_data":"656D4B74","odm":"AILABS_SG02_QW"}""")
        assertTrue(ev1 is QwenEvent.ActiveData)
        assertEquals("656D4B74", (ev1 as QwenEvent.ActiveData).activeData)

        // pairAdv / pid
        val ev2 = QwenEvents.parse("""{"pairAdv":false,"pid":8665,"peerAddr":"22:c1:37:10:6e:b4"}""")
        assertTrue(ev2 is QwenEvent.PairInfo)
        assertEquals(8665, (ev2 as QwenEvent.PairInfo).pid)

        // type:10001
        val ev3 = QwenEvents.parse("""{"type":10001,"arg1":1,"arg2":1}""")
        assertTrue(ev3 is QwenEvent.Type10001Q)

        // attach_success
        val ev4 = QwenEvents.parse("""{"code":1,"msg":"attach_success"}""")
        assertTrue(ev4 is QwenEvent.AttachSuccess)
    }

    /** 用协程 delay 轮询等待握手进入目标状态（最多 3 秒） */
    private suspend fun awaitState(target: HandshakeState) {
        val deadline = System.currentTimeMillis() + 3000
        while (QwenHandshake.state != target && System.currentTimeMillis() < deadline) {
            delay(10)
        }
        if (QwenHandshake.state != target) {
            throw AssertionError("握手未进入 $target，当前=${QwenHandshake.state}")
        }
    }
}
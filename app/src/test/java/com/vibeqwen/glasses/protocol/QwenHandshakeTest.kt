package com.vibeqwen.glasses.protocol

import kotlinx.coroutines.async
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 握手状态机单元测试：验证回包驱动（门闩推进）逻辑正确。
 * 测试通过主动喂入眼镜回包让握手快速通过（避免长超时等待）。
 */
class QwenHandshakeTest {

    @Test
    fun `握手在收到眼镜回包后进入 READY`() = runBlocking {
        QwenHandshake.reset()
        val sent = mutableListOf<String>()
        val states = mutableListOf<HandshakeState>()

        val handshakeJob = async {
            QwenHandshake.run(
                write = { sent.add(it) },
                onState = { states.add(it) }
            )
        }

        // 模拟眼镜回包：先喂 active_data（解除 infoGate），再喂 attach_success（解除 attachGate）
        delay(200)
        QwenHandshake.onIncoming("""{"active_data":"656D4B74446A","odm":"AILABS_SG02_QW"}""")
        QwenHandshake.onIncoming("""{"pairAdv":false,"pid":8665,"peerAddr":"22:c1:37:10:6e:b4"}""")
        delay(200)
        QwenHandshake.onIncoming("""{"type":10001,"arg1":1,"arg2":1}""")
        QwenHandshake.onIncoming("""{"code":1,"msg":"attach_success"}""")

        val result = kotlinx.coroutines.withTimeoutOrNull(5000) { handshakeJob.await(); "done" }
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

        val handshakeJob = async {
            QwenHandshake.run(
                write = { sent.add(it) },
                onState = {}
            )
        }

        delay(200)
        QwenHandshake.onIncoming("""{"active_data":"AAA","odm":"AILABS_SG02_QW"}""")
        delay(200)
        QwenHandshake.onIncoming("""{"code":1,"msg":"attach_success"}""")

        val result = kotlinx.coroutines.withTimeoutOrNull(5000) { handshakeJob.await(); "done" }
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
}
package com.vibeqwen.glasses.protocol

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * 控制通道 JSON 流解复用测试：完整/分片/多段/混合流。
 */
class JsonStreamAssemblerTest {

    private fun makeAssembler(
        onJson: (String) -> Unit = { },
        onNonJson: (ByteArray) -> Unit = { },
    ) = JsonStreamAssembler(onJson, onNonJson)

    @Test
    fun `完整JSON单次回调`() {
        val jsons = mutableListOf<String>()
        val a = makeAssembler(onJson = { jsons.add(it) })
        a.feed("""{"device":[]}""".toByteArray())
        assertEquals(1, jsons.size)
        assertEquals("""{"device":[]}""", jsons[0])
    }

    @Test
    fun `JSON分片重组`() {
        val jsons = mutableListOf<String>()
        val a = makeAssembler(onJson = { jsons.add(it) })
        val raw = """{"eventType":"power-state","eventName":"record_start","a":1}"""
        val parts = listOf(raw.substring(0, 9), raw.substring(9, 24), raw.substring(24))
        parts.forEach { a.feed(it.toByteArray()) }
        assertEquals(1, jsons.size)
        assertEquals(raw, jsons[0])
    }

    @Test
    fun `一包多条JSON`() {
        val jsons = mutableListOf<String>()
        val a = makeAssembler(onJson = { jsons.add(it) })
        a.feed("""{"a":1}{"b":2}""".toByteArray())
        assertEquals(2, jsons.size)
        assertEquals("""{"a":1}""", jsons[0])
        assertEquals("""{"b":2}""", jsons[1])
    }

    @Test
    fun `JSON后的非JSON字节走回调`() {
        val jsons = mutableListOf<String>()
        val raws = mutableListOf<ByteArray>()
        val a = makeAssembler(onJson = { jsons.add(it) }, onNonJson = { raws.add(it) })
        a.feed("""{"x":1}AT+GARBAGE""".toByteArray())
        assertEquals(1, jsons.size)
        assertEquals(1, raws.size)
        assertEquals("AT+GARBAGE", String(raws[0], Charsets.UTF_8))
    }

    @Test
    fun `纯音频字节不触发JSON`() {
        val jsons = mutableListOf<String>()
        val raws = mutableListOf<ByteArray>()
        val a = makeAssembler(onJson = { jsons.add(it) }, onNonJson = { raws.add(it) })
        val frame = ByteArray(398) { it.toByte() }
        a.feed(frame)
        assertEquals(0, jsons.size)
        assertEquals(1, raws.size)
        assertTrue(raws[0].contentEquals(frame))
    }
}
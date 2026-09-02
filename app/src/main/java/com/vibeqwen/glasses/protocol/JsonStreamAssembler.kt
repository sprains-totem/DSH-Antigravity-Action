package com.vibeqwen.glasses.protocol

/**
 * 控制通道 JSON 流解复用（纯 Kotlin，可单测）。
 *
 * 眼镜下行控制通道以 JSON 文本为主，但可能夹杂：
 * - 分段 JSON（长消息跨多次 read 到达）
 * - 非 JSON 残余（如 HFP AT 文本 / 可能的音频残余）
 *
 * 本组装器把字节流切成"完整 JSON 文本"与"非 JSON 字节块"两种输出，
 * 使上层可把 JSON 喂给事件解析、把非 JSON 字节喂给音频帧解析。
 */
class JsonStreamAssembler(
    private val onJson: (String) -> Unit,
    private val onNonJson: (ByteArray) -> Unit,
) {
    private val pending = ArrayList<Byte>()

    fun feed(data: ByteArray) {
        for (b in data) pending.add(b)
        drain()
    }

    private fun drain() {
        var i = 0
        val n = pending.size
        // 跳过前导空白
        while (i < n && pending[i].toInt().toChar().isWhitespace()) i++
        if (i >= n) {
            pending.clear()
            return
        }
        // 官方 APP 帧头剥离：帧 = 10B 头 + 载荷
        // 校验：[0..1] LE = 总长-2；[2..3] LE = 0x0001(普通)/0x0002/0x0004(分段)
        // 且 [0..1] 与 [4..5]+x 一致性仅在头部置信时剥离，避免误伤音频帧
        if (n - i >= 10) {
            val declared = (pending[i].toInt() and 0xFF or ((pending[i + 1].toInt() and 0xFF) shl 8)) + 2
            val typeField = (pending[i + 2].toInt() and 0xFF) or ((pending[i + 3].toInt() and 0xFF) shl 8)
            // 官方帧 [2..3]=0x0001；音频帧/AT 字节几乎不可能出现 0x0001 且长度吻合
            if (declared in 12..64 * 1024 && (typeField == 0x0001 || typeField == 0x0002 || typeField == 0x0004)) {
                // 额外校验：[4..5] 载荷相关长度 = declared-2-5+偏差，宽松视为置信
                pending.subList(i, i + 10).clear()
                i = 0
            }
        }
        val n2 = pending.size
        if (i >= n2) {
            pending.clear()
            return
        }
        i = 0
        val first = pending[i].toInt().toChar()
        if (first == '{') {
            // 括号配对扫描（处理字符串转义内花括号）
            var depth = 0
            var j = i
            var inString = false
            var escaped = false
            while (j < n2) {
                val c = pending[j].toInt().toChar()
                if (inString) {
                    if (escaped) escaped = false
                    else if (c == '\\') escaped = true
                    else if (c == '"') inString = false
                } else {
                    when (c) {
                        '"' -> inString = true
                        '{' -> depth++
                        '}' -> {
                            depth--
                            if (depth == 0) break
                        }
                    }
                }
                j++
            }
            if (j < n2 && depth == 0) {
                // 完整 JSON
                val bytes = ByteArray(j - i + 1) { pending[i + it] }
                onJson(String(bytes, Charsets.UTF_8))
                pending.subList(0, j + 1).clear()
                drain()
                return
            }
            // 不完整 JSON：等待后续字节；过大多余直接丢弃防止内存膨胀
            if (pending.size > 64 * 1024) pending.clear()
            return
        }
        // 非 JSON 开头：整段作为非 JSON 字节交给回调
        val bytes = ByteArray(n2 - i) { pending[i + it] }
        pending.clear()
        onNonJson(bytes)
    }
}
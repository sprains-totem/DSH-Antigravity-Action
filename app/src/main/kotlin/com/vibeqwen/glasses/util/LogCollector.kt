package com.vibeqwen.glasses.util

import android.content.Context
import android.os.Build
import android.os.Environment
import android.util.Log
import java.io.File
import java.io.FileOutputStream
import java.io.PrintWriter
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.ConcurrentLinkedQueue

/**
 * APP 内日志收集器：捕获连接/握手/录音/传输层的运行日志，
 * 支持导出为文本文件（便于调试与上报）。
 *
 * 设计：
 *  - 内存环形缓冲（最近 N 条），低开销
 *  - 同时镜像到 logcat（tag 前缀），便于 adb logcat 排查
 *  - 导出为带时间戳的日志文件（含设备/系统信息头部）
 */
object LogCollector {

    private const val TAG = "vibeLog"
    private const val MAX_BUFFER = 5000

    private val buffer = ConcurrentLinkedQueue<String>()
    @Volatile private var enabled = true

    /** 是否启用（可全局开关） */
    var isEnabled: Boolean
        get() = enabled
        set(value) { enabled = value }

    /** 记录一条日志（带时间戳） */
    @JvmStatic
    fun log(scope: String, message: String) {
        if (!enabled) return
        val ts = SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())
        val line = "$ts [$scope] $message"
        // 缓冲
        buffer.add(line)
        while (buffer.size > MAX_BUFFER) buffer.poll()
        // logcat 镜像
        Log.i("$TAG/$scope", message)
    }

    /** 便捷：连接层 */
    @JvmStatic
    fun c(message: String) = log("CONN", message)

    /** 便捷：握手层 */
    @JvmStatic
    fun h(message: String) = log("HANDSHAKE", message)

    /** 便捷：协议/帧层 */
    @JvmStatic
    fun p(message: String) = log("PROTO", message)

    /** 便捷：录音层 */
    @JvmStatic
    fun r(message: String) = log("RECORD", message)

    /** 便捷：错误 */
    @JvmStatic
    fun e(message: String) = log("ERROR", message)

    /** 当前全部缓冲日志（按时间顺序） */
    @JvmStatic
    fun dump(): List<String> = buffer.toList()

    /**
     * 导出日志到文件。
     * @return 生成的日志文件（null=失败）
     */
    @JvmStatic
    fun export(context: Context): File? {
        return try {
            val dir = File(context.getExternalFilesDir(null) ?: context.filesDir, "logs")
            if (!dir.exists()) dir.mkdirs()
            val name = "vibeqwen_${SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())}.log"
            val file = File(dir, name)
            PrintWriter(FileOutputStream(file), true).use { pw ->
                // 头部：设备/系统信息
                pw.println("==========================================")
                pw.println("vibeQwenGlasses 日志导出")
                pw.println("时间: ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())}")
                pw.println("设备: ${Build.MANUFACTURER} ${Build.MODEL}")
                pw.println("系统: Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
                pw.println("==========================================")
                pw.println()
                // 日志体
                buffer.forEach { pw.println(it) }
                pw.println()
                pw.println("===== END =====")
            }
            file
        } catch (e: Exception) {
            Log.e(TAG, "导出日志失败: ${e.message}")
            null
        }
    }

    /** 清空缓冲 */
    @JvmStatic
    fun clear() = buffer.clear()

    /** 缓冲区当前条数 */
    @JvmStatic
    val size: Int get() = buffer.size
}

/** ByteArray → Hex 字符串（顶层扩展，全包可见） */
fun ByteArray.toHex(): String = joinToString("") { "%02X".format(it) }
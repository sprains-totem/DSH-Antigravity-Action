package com.vibeqwen.glasses.util

import android.content.Context
import android.content.pm.PackageManager
import android.os.ParcelFileDescriptor
import rikka.shizuku.Shizuku
import rikka.shizuku.ShizukuProvider

/**
 * Shizuku 密钥读取器（方案三）：通过 Shizuku 授权读取官方千问 APP
 * （com.alibaba.wow）存储的 BLE 认证密钥，验证复用认证是否可行。
 *
 * 需要：手机已安装 Shizuku（moe.shizuku.privileged.api）并授权本 APP。
 * 用法：
 *   val result = ShizukuKeyReader.readOfficialBleKey(context)  // 返回文本
 */
object ShizukuKeyReader {

    /** 官方千问 APP 包名 */
    const val OFFICIAL_PKG = "com.alibaba.wow"
    private const val PREFS_DIR = "/data/data/$OFFICIAL_PKG/shared_prefs"

    /** Shizuku 是否可用（binder 存在） */
    fun isShizukuAvailable(): Boolean = Shizuku.pingBinder()

    /** 是否已获得 Shizuku 授权 */
    fun isGranted(): Boolean =
        Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED

    /**
     * 用 Shizuku 的 shell 权限执行命令。
     * @return 命令 stdout（null=失败）
     */
    fun sh(command: String): String? {
        if (!isShizukuAvailable()) return null
        if (!isGranted()) return null
        return try {
            // 通过 Shizuku 启动 Shell 进程（ProcessBuilder 形式）
            val process = Shizuku.newProcess(
                ProcessBuilder("sh", "-c", command)
            )
            val text = process.inputStream.bufferedReader().readText()
            process.waitFor()
            text.trim()
        } catch (e: Exception) {
            null
        }
    }

    /** 读取官方 APP 的 BLE 认证密钥（prefs 全部相关内容） */
    fun readOfficialBleKey(): String {
        val sb = StringBuilder()
        sb.append("=== 官方APP BLE密钥读取 ===\n")
        sb.append("包名: $OFFICIAL_PKG\n")
        sb.append("Shizuku: ${if (isShizukuAvailable()) "可用" else "不可用"} / 授权: ${if (isGranted()) "已授权" else "未授权"}\n\n")

        // 1. 列出 prefs 文件
        val ls = sh("ls -la $PREFS_DIR/")
        sb.append("--- prefs 目录 ---\n${ls ?: "(无法访问，请确认 Shizuku 已授权)"}\n\n")

        // 2. 搜索密钥内容
        val grep = sh("grep -rE 'GMA_BLE_KEY|32BleKey|bleKey16|psk_key|local32BleKey|gma_last_success' $PREFS_DIR/")
        sb.append("--- 密钥内容 ---\n${grep ?: "(未搜到密钥)"}\n\n")

        // 3. 特殊：读 gma 相关 key 的原始值
        val getShared = sh("cat $PREFS_DIR/*.xml")
        if (getShared != null) {
            val filtered = getShared.split('\n').filter {
                it.contains("GMA_BLE_KEY") || it.contains("bleKey") ||
                    it.contains("bind_device") || it.contains("local32BleKey")
            }.joinToString("\n")
            if (filtered.isNotBlank()) {
                sb.append("--- prefs XML 过滤 ---\n$filtered\n")
            }
        }
        return sb.toString()
    }
}
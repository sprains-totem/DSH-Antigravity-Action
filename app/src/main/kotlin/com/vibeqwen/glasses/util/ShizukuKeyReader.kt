package com.vibeqwen.glasses.util

import android.content.pm.PackageManager
import android.os.ParcelFileDescriptor
import rikka.shizuku.Shizuku

/**
 * 官方千问 APP BLE 密钥读取器（方案三）。
 *
 * 读取 /data/data/com.alibaba.wow/shared_prefs 中的 GMA_BLE_KEY。
 * 方式（按优先级）：
 *  1) Shizuku 授权后执行命令（`Shizuku.newProcess(String[],String[],String)`）
 *  2) root（su -c）兜底
 */
object ShizukuKeyReader {

    const val OFFICIAL_PKG = "com.alibaba.wow"
    private const val PREFS_DIR = "/data/data/$OFFICIAL_PKG/shared_prefs"

    /** Shizuku binder 是否存在（服务已启动） */
    fun isShizukuAvailable(): Boolean = try {
        Shizuku.pingBinder()
    } catch (e: Exception) {
        false
    }

    /** 是否已获得 Shizuku 授权 */
    fun isGranted(): Boolean = try {
        Shizuku.checkSelfPermission() == PackageManager.PERMISSION_GRANTED
    } catch (e: Exception) {
        false
    }

    /**
     * 发起 Shizuku 授权请求（异步，系统弹授权框）。
     * 授权完成后由用户再次点击"读取"即可直接读取。
     * @return 是否成功发起（false 表示 Shizuku 不可用/已授权无需请求）
     */
    fun requestPermission(): Boolean {
        if (!isShizukuAvailable() || isGranted()) return false
        // 一次性 listener：注册后主动请求；回调里自移除
        val listener = Shizuku.OnRequestPermissionResultListener { _, grantResult ->
            try {
                Shizuku.removeRequestPermissionResultListener(listener)
            } catch (_: Exception) {
            }
        }
        return try {
            Shizuku.addRequestPermissionResultListener(listener)
            Shizuku.requestPermission(1001)
            true
        } catch (e: Exception) {
            try {
                Shizuku.removeRequestPermissionResultListener(listener)
            } catch (_: Exception) {
            }
            false
        }
    }

    /**
     * 用 Shizuku 的 shell 权限执行命令（newProcess 三参版，公开 API）。
     * @return stdout（null=失败）
     */
    fun shShizuku(command: String): String? {
        if (!isShizukuAvailable() || !isGranted()) return null
        return try {
            val pfd: ParcelFileDescriptor =
                Shizuku.newProcess(arrayOf("sh", "-c", command), null, null)
            val input = ParcelFileDescriptor.AutoCloseInputStream(pfd)
            val text = input.bufferedReader().readText()
            input.close()
            pfd.close()
            text.trim()
        } catch (e: Exception) {
            null
        }
    }

    /** 是否有 root（su 可用） */
    fun hasRoot(): Boolean = try {
        val p = Runtime.getRuntime().exec(arrayOf("su", "-c", "id"))
        val out = p.inputStream.bufferedReader().readText()
        p.waitFor()
        out.contains("uid=0")
    } catch (e: Exception) {
        false
    }

    private fun shRoot(command: String): String? = try {
        val p = Runtime.getRuntime().exec(arrayOf("su", "-c", command))
        val out = p.inputStream.bufferedReader().readText()
        p.waitFor()
        out.trim().ifEmpty { null }
    } catch (e: Exception) {
        null
    }

    /** 执行命令：Shizuku 优先，root 兜底 */
    private fun sh(command: String): String? = shShizuku(command) ?: shRoot(command)

    /** 读取官方 APP 的 BLE 认证密钥 */
    fun readOfficialBleKey(): String {
        val sb = StringBuilder()
        sb.append("=== 官方APP BLE密钥读取 ===\n")
        sb.append("包名: $OFFICIAL_PKG\n")
        sb.append("Shizuku: ${if (isShizukuAvailable()) "已启动" else "未启动"} / 授权: ${if (isGranted()) "已授权" else "未授权"}\n")
        sb.append("root: ${if (hasRoot()) "可用" else "不可用"}\n\n")

        if (!isShizukuAvailable() && !hasRoot()) {
            sb.append("说明：两种权限都不可用。\n")
            sb.append("请安装并启动 Shizuku（moe.shizuku.privileged.api），\n")
            sb.append("返回本页点按钮 → 系统弹窗点允许 → 再点一次读取。\n")
            return sb.toString()
        }

        if (isShizukuAvailable() && !isGranted()) {
            sb.append("提示：请在系统弹出的 Shizuku 授权框中允许后，再点一次「读取官方密钥」。\n\n")
        }

        val ls = sh("ls -la $PREFS_DIR/")
        sb.append("--- prefs 目录 ---\n${ls ?: "(无法访问 $PREFS_DIR/)"}\n\n")

        val grep = sh("grep -rE 'GMA_BLE_KEY|32BleKey|bleKey16|psk_key|local32BleKey|gma_last_success' $PREFS_DIR/")
        sb.append("--- 密钥内容 ---\n${grep ?: "(未搜到密钥)"}\n\n")

        val xml = sh("cat $PREFS_DIR/*.xml")
        if (xml != null) {
            val filtered = xml.split('\n').filter {
                it.contains("GMA_BLE_KEY") || it.contains("bleKey") ||
                    it.contains("bind_device") || it.contains("local32BleKey")
            }.joinToString("\n")
            if (filtered.isNotBlank()) sb.append("--- prefs XML 过滤 ---\n$filtered\n")
        }
        return sb.toString()
    }
}
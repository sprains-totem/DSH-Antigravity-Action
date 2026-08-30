package com.vibeqwen.glasses.util

import java.io.DataInputStream
import java.io.DataOutputStream

/**
 * 官方千问 APP BLE 密钥读取器（方案三）。
 *
 * 读 /data/data/com.alibaba.wow/shared_prefs 中的 GMA_BLE_KEY。
 * 方式：
 *  1) root：执行 `su -c cat ...`（Magisk/KernelSU）
 *  2) Shizuku 已授权时，通过 `su` 不可行则尝试 sh 桥接（提示用户先 root 或手动授权）
 * 实际推荐 root 方式最简单可靠。
 */
object ShizukuKeyReader {

    const val OFFICIAL_PKG = "com.alibaba.wow"
    private const val PREFS_DIR = "/data/data/$OFFICIAL_PKG/shared_prefs"

    /** 是否有 root（su 可用） */
    fun hasRoot(): Boolean = try {
        val p = Runtime.getRuntime().exec(arrayOf("su", "-c", "id"))
        val out = p.inputStream.bufferedReader().readText()
        p.waitFor()
        out.contains("uid=0")
    } catch (e: Exception) {
        false
    }

    /** 用 root 执行命令 */
    fun shRoot(command: String): String? = try {
        val p = Runtime.getRuntime().exec(arrayOf("su", "-c", command))
        val out = p.inputStream.bufferedReader().readText()
        val err = p.errorStream.bufferedReader().readText()
        p.waitFor()
        out.trim().ifEmpty { err.trim().ifEmpty { null } }
    } catch (e: Exception) {
        null
    }

    /** Shizuku 状态（提示用；实际读取依赖 root） */
    fun isShizukuAvailable(): Boolean = try {
        rikka.shizuku.Shizuku.pingBinder()
    } catch (e: Exception) {
        false
    }

    fun isShizukuGranted(): Boolean = try {
        rikka.shizuku.Shizuku.checkSelfPermission() == android.content.pm.PackageManager.PERMISSION_GRANTED
    } catch (e: Exception) {
        false
    }

    /** 读取官方 APP 的 BLE 认证密钥 */
    fun readOfficialBleKey(): String {
        val sb = StringBuilder()
        sb.append("=== 官方APP BLE密钥读取 ===\n")
        sb.append("包名: $OFFICIAL_PKG\n")
        sb.append("root: ${if (hasRoot()) "可用" else "不可用（需 Magisk/KernelSU）"}\n")
        sb.append("Shizuku: ${if (isShizukuAvailable()) "binder可用" else "不可用"} / 授权: ${if (isShizukuGranted()) "已授权" else "未授权"}\n\n")

        if (!hasRoot()) {
            sb.append("说明：读取 /data/data/$OFFICIAL_PKG 需要 root（su）\n")
            sb.append("如已装 Shizuku，可在 Shizuku 授权后改用下面命令手动验证：\n")
            sb.append("  sh /data/user_de/0/moe.shizuku.privileged.api/start.sh\n")
            sb.append("  (然后执行 cat $PREFS_DIR/*.xml 有权限的部分)\n")
            return sb.toString()
        }

        val ls = shRoot("ls -la $PREFS_DIR/")
        sb.append("--- prefs 目录 ---\n${ls ?: "(ls 失败)"}\n\n")

        val grep = shRoot("grep -rE 'GMA_BLE_KEY|32BleKey|bleKey16|psk_key|local32BleKey|gma_last_success' $PREFS_DIR/")
        sb.append("--- 密钥内容 ---\n${grep ?: "(未搜到)"}\n\n")

        val xml = shRoot("cat $PREFS_DIR/*.xml")
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
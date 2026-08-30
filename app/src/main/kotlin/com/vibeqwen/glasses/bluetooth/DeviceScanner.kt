package com.vibeqwen.glasses.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import com.vibeqwen.glasses.protocol.QwenConstants

/**
 * 设备扫描 / 过滤：列出已配对设备并筛出千问 G1 眼镜。
 *
 * 不依赖蓝牙发现（扫描），仅读取已配对列表（API 31+ 需要 BLUETOOTH_CONNECT 权限，
 * 由调用方在运行时申请）。过滤规则：名称含 G1/QWEN/GLASSES/QUARK 关键字，或 MAC 命中
 * PROTOCOL.md §8.1 修正后的真实眼镜 MAC。
 */
data class PairedDevice(
    val address: String,
    val name: String?,
    val isGlasses: Boolean
)

object DeviceScanner {

    /**
     * 从已配对设备里筛出眼镜。
     * @param adapter 蓝牙适配器（FROM BluetoothManager）
     */
    @SuppressLint("MissingPermission")
    fun listGlasses(adapter: BluetoothAdapter?): List<PairedDevice> {
        if (adapter == null || !adapter.isEnabled) return emptyList()
        val bonded: Set<BluetoothDevice> = try {
            adapter.bondedDevices ?: emptySet()
        } catch (_: SecurityException) {
            emptySet()
        }
        return bonded.map { dev ->
            val name = dev.name
            val address = dev.address
            val isGlasses = isGlasses(name, address)
            PairedDevice(address, name, isGlasses)
        }.sortedWith(compareBy({ !it.isGlasses }, { it.name ?: it.address }))
    }

    fun isGlasses(name: String?, address: String): Boolean {
        val mac = address.uppercase()
        if (mac == QwenConstants.GLASSES_MAC.uppercase()) return true
        val n = name?.uppercase() ?: return false
        return QwenConstants.GLASSES_NAME_HINTS.any { n.contains(it) }
    }

    /**
     * 在已配对列表中按 MAC 精确查找（用于「连接已知设备」）。
     */
    @SuppressLint("MissingPermission")
    fun findByAddress(adapter: BluetoothAdapter?, address: String): BluetoothDevice? {
        if (adapter == null) return null
        return try {
            adapter.bondedDevices?.firstOrNull { it.address.equals(address, ignoreCase = true) }
        } catch (_: SecurityException) {
            null
        }
    }
}

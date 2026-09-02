package com.vibeqwen.glasses.bluetooth

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanFilter
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import android.content.Context
import android.os.Handler
import android.os.Looper
import android.os.ParcelUuid
import com.vibeqwen.glasses.protocol.QwenConstants
import com.vibeqwen.glasses.util.LogCollector

/**
 * BLE 广播扫描器：按官方 APP 的过滤特征寻找眼镜。
 *
 * 特征（从官方 APP bluetooth_manager 逆向确认）：
 *  - Service UUID: 0xFEB3（Alibaba 私有）
 *  - ManufacturerId: 424 (0x1A8)，厂商数据 "WoW" / "QWE"
 */
class BleGlassesScanner(private val context: Context) {

    @SuppressLint("MissingPermission")
    fun scan(durationMs: Long = 6000, onFound: (BluetoothDevice, ByteArray) -> Unit, onDone: () -> Unit) {
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: run { onDone(); return }
        val scanner = adapter.bluetoothLeScanner ?: run { onDone(); return }

        val filters = listOf(
            ScanFilter.Builder()
                .setServiceUuid(ParcelUuid(QwenConstants.UUID_BLE_GLASSES_SERVICE_FEB3))
                .setManufacturerData(QwenConstants.BLE_GLASSES_MANUFACTURER_ID, QwenConstants.BLE_GLASSES_ADV_WOW)
                .build(),
            ScanFilter.Builder()
                .setServiceUuid(ParcelUuid(QwenConstants.UUID_BLE_GLASSES_SERVICE_FEB3))
                .setManufacturerData(QwenConstants.BLE_GLASSES_MANUFACTURER_ID, QwenConstants.BLE_GLASSES_ADV_QWE)
                .build(),
        )
        val settings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        val callback = object : ScanCallback() {
            override fun onScanResult(callbackType: Int, result: ScanResult) {
                val device = result.device
                val adv = result.scanRecord?.bytes ?: ByteArray(0)
                LogCollector.log("BLE", "扫描到: ${device.address} rssi=${result.rssi} adv=${adv.size}B")
                try {
                    // manufacturerSpecificData 是 SparseArray<ByteArray>，用索引遍历
                    val mfrData = result.scanRecord?.manufacturerSpecificData
                    if (mfrData != null) {
                        for (i in 0 until mfrData.size()) {
                            val mfrId = mfrData.keyAt(i)
                            val data = mfrData.valueAt(i)
                            LogCollector.log("BLE", "  mfr=$mfrId data=${data.joinToString("") { "%02X".format(it) }}")
                        }
                    }
                } catch (_: Exception) {
                }
                onFound(device, adv)
            }

            override fun onScanFailed(errorCode: Int) {
                LogCollector.log("BLE", "扫描失败: $errorCode")
                onDone()
            }
        }

        try {
            LogCollector.log("BLE", "开始扫描 0xFEB3 + WoW/QWE 特征，${durationMs}ms")
            scanner.startScan(filters, settings, callback)
        } catch (e: Exception) {
            LogCollector.log("BLE", "startScan 失败: ${e.message}")
            onDone()
            return
        }

        Handler(Looper.getMainLooper()).postDelayed({
            try {
                scanner.stopScan(callback)
            } catch (_: Exception) {
            }
            LogCollector.log("BLE", "扫描结束")
            onDone()
        }, durationMs)
    }
}
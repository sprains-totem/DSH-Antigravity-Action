package com.vibeqwen.glasses.ui.connect

import android.bluetooth.BluetoothManager
import android.content.Context
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.vibeqwen.glasses.ConnectionController
import com.vibeqwen.glasses.GlassesApp
import com.vibeqwen.glasses.bluetooth.DeviceScanner
import com.vibeqwen.glasses.bluetooth.PairedDevice
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 连接页 ViewModel：桥接 [ConnectionController] 与 UI。
 */
class ConnectViewModel(app: android.app.Application) : AndroidViewModel(app) {

    private val controller = (app as GlassesApp).controller

    val connectionState: StateFlow<com.vibeqwen.glasses.ConnectionState> = controller.connectionState
    val handshakeState: StateFlow<com.vibeqwen.glasses.protocol.HandshakeState> = controller.handshakeState
    val deviceName: StateFlow<String?> = controller.deviceName
    val lastError: StateFlow<String?> = controller.lastError
    val toast = controller.toastEvents

    private val _devices = MutableStateFlow<List<PairedDevice>>(emptyList())
    val devices: StateFlow<List<PairedDevice>> = _devices.asStateFlow()

    fun loadDevices(context: Context) {
        viewModelScope.launch {
            try {
                val adapter = (context.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter
                _devices.value = DeviceScanner.listGlasses(adapter)
            } catch (se: SecurityException) {
                _devices.value = emptyList()
            }
        }
    }

    fun connect(address: String) = controller.connectByAddress(address)

    fun disconnect() = controller.disconnect()

    fun clearError() = controller.clearError()
}

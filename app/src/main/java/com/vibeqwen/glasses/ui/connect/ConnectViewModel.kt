package com.vibeqwen.glasses.ui.connect

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vibeqwen.glasses.bluetooth.DeviceScanner
import com.vibeqwen.glasses.service.ConnectionState
import com.vibeqwen.glasses.service.GlassesBus
import com.vibeqwen.glasses.service.GlassesConnectionService
import com.vibeqwen.glasses.service.ServiceUiState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 连接页 ViewModel：已配对设备列表 + 连接动作 + 服务状态透传。
 */
class ConnectViewModel : ViewModel() {

    private val _devices = MutableStateFlow<List<DeviceScanner.GlassesDevice>>(emptyList())
    val devices: StateFlow<List<DeviceScanner.GlassesDevice>> = _devices.asStateFlow()

    val state: StateFlow<ServiceUiState> = GlassesBus.uiState

    /** 刷新已配对设备列表 */
    fun refresh(context: Context) {
        viewModelScope.launch {
            _devices.value = DeviceScanner.listBonded(context)
        }
    }

    /** 连接指定 MAC（前台服务） */
    fun connect(context: Context, mac: String) {
        GlassesConnectionService.connect(context, mac)
    }

    /** 断开 */
    fun disconnect(context: Context) {
        GlassesConnectionService.disconnect(context)
    }

    companion object {
        /** 需要请求的运行时权限（按 API 分级） */
        fun requiredPermissions(): List<String> = buildList {
            if (Build.VERSION.SDK_INT >= 33) add(Manifest.permission.POST_NOTIFICATIONS)
            if (Build.VERSION.SDK_INT >= 31) {
                add(Manifest.permission.BLUETOOTH_CONNECT)
            } else {
                add(Manifest.permission.ACCESS_FINE_LOCATION)
            }
        }

        fun hasPermissions(context: Context): Boolean =
            requiredPermissions().all {
                ContextCompat.checkSelfPermission(context, it) == PackageManager.PERMISSION_GRANTED
            }

        fun isConnectedState(state: ServiceUiState): Boolean =
            state.connection == ConnectionState.READY || state.connection == ConnectionState.CONNECTING ||
                state.connection == ConnectionState.HANDSHAKING
    }
}
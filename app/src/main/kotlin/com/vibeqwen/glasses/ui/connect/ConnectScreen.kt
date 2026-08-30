package com.vibeqwen.glasses.ui.connect

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vibeqwen.glasses.ConnectionState
import com.vibeqwen.glasses.bluetooth.PairedDevice
import com.vibeqwen.glasses.protocol.HandshakeState

@Composable
fun ConnectScreen(
    modifier: Modifier = Modifier,
    vm: ConnectViewModel = viewModel()
) {
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }

    val connState by vm.connectionState.collectAsStateWithLifecycle()
    val handState by vm.handshakeState.collectAsStateWithLifecycle()
    val devName by vm.deviceName.collectAsStateWithLifecycle()
    val error by vm.lastError.collectAsStateWithLifecycle()
    val devices by vm.devices.collectAsStateWithLifecycle()

    // 进入页面即刷新已配对设备
    LaunchedEffect(Unit) { vm.loadDevices(context) }
    // 错误提示
    LaunchedEffect(error) { error?.let { snackbar.showSnackbar(it) ; vm.clearError() } }
    // 瞬时消息
    LaunchedEffect(Unit) {
        vm.toast.collect { snackbar.showSnackbar(it) }
    }

    Column(modifier.padding(16.dp)) {
        Text("连接千问 G1 眼镜", style = MaterialTheme.typography.titleLarge)
        Text(
            "状态：${stateLabel(connState)}" + if (connState == ConnectionState.HANDSHAKING) "（${handStateLabel(handState)}）" else "",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        devName?.let {
            Text("已连接设备：$it", color = MaterialTheme.colorScheme.primary)
        }

        androidx.compose.foundation.layout.Spacer(Modifier.padding(8.dp))

        Button(
            onClick = { vm.loadDevices(context) },
            modifier = Modifier.fillMaxWidth()
        ) { Text("刷新已配对设备") }

        if (connState == ConnectionState.READY || connState == ConnectionState.CONNECTED || connState == ConnectionState.HANDSHAKING) {
            Button(
                onClick = { vm.disconnect() },
                modifier = Modifier.fillMaxWidth(),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = MaterialTheme.colorScheme.errorContainer,
                    contentColor = MaterialTheme.colorScheme.onErrorContainer
                )
            ) { Text("断开连接") }
        }

        androidx.compose.foundation.layout.Spacer(Modifier.padding(8.dp))
        Text("已配对设备", style = MaterialTheme.typography.titleMedium)

        if (devices.isEmpty()) {
            Column(
                Modifier.fillMaxWidth().weight(1f),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("未找到已配对设备。请先在系统蓝牙中配对眼镜（MAC 含 A0:FB:C5:21:9B:20）。",
                    color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(Modifier.weight(1f)) {
                items(devices) { dev ->
                    DeviceRow(dev, connState, vm::connect)
                }
            }
        }
    }

    SnackbarHost(snackbar, modifier = Modifier.fillMaxSize())
}

@Composable
private fun DeviceRow(
    dev: PairedDevice,
    connState: ConnectionState,
    onConnect: (String) -> Unit
) {
    Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Column(Modifier.padding(12.dp)) {
            Text(dev.name ?: "(未知名称)", style = MaterialTheme.typography.bodyLarge)
            Text(dev.address, style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (dev.isGlasses) {
                androidx.compose.foundation.layout.Spacer(Modifier.padding(4.dp))
                Button(
                    onClick = { onConnect(dev.address) },
                    enabled = connState == ConnectionState.DISCONNECTED || connState == ConnectionState.FAILED
                ) { Text("连接眼镜") }
            }
        }
    }
}

private fun stateLabel(s: ConnectionState): String = when (s) {
    ConnectionState.DISCONNECTED -> "未连接"
    ConnectionState.CONNECTING -> "连接中…"
    ConnectionState.CONNECTED -> "已连接"
    ConnectionState.HANDSHAKING -> "握手中…"
    ConnectionState.READY -> "就绪"
    ConnectionState.FAILED -> "连接失败"
}

private fun handStateLabel(s: HandshakeState): String = when (s) {
    HandshakeState.IDLE -> "空闲"
    HandshakeState.SENDING_HELLO -> "问候"
    HandshakeState.NEGOTIATING -> "协商"
    HandshakeState.AUTHING -> "认证"
    HandshakeState.READY -> "完成"
    HandshakeState.FAILED -> "失败"
}

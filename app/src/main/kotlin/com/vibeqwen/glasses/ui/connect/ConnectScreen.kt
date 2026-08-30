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
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.core.content.FileProvider
import com.vibeqwen.glasses.ConnectionState
import com.vibeqwen.glasses.bluetooth.PairedDevice
import com.vibeqwen.glasses.protocol.HandshakeState
import com.vibeqwen.glasses.util.LogCollector
import kotlinx.coroutines.launch
import android.content.Intent

@Composable
fun ConnectScreen(
    modifier: Modifier = Modifier,
    vm: ConnectViewModel = viewModel()
) {
    val context = LocalContext.current
    val snackbar = remember { SnackbarHostState() }
    val scope = rememberCoroutineScope()
    var rfShowKeyResult by remember { mutableStateOf<String?>(null) }

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

        Column(
            Modifier
                .fillMaxWidth()
                .padding(top = 12.dp)
        ) {
            Text("调试", style = MaterialTheme.typography.titleSmall)
            OutlinedButton(
                onClick = {
                    scope.launch {
                        LogCollector.log("UI", "用户点击导出日志")
                        val file = LogCollector.export(context)
                        if (file != null) {
                            LogCollector.log("UI", "日志已导出: ${file.absolutePath}")
                            // 分享日志文件
                            try {
                                val uri = FileProvider.getUriForFile(context, context.packageName + ".fileprovider", file)
                                val intent = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/plain"
                                    putExtra(Intent.EXTRA_STREAM, uri)
                                    addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
                                }
                                context.startActivity(Intent.createChooser(intent, "分享日志"))
                            } catch (e: Exception) {
                                snackbar.showSnackbar("导出成功：${file.absolutePath}")
                            }
                        } else {
                            snackbar.showSnackbar("导出日志失败")
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) { Text("导出日志 (${LogCollector.size} 条)") }
            OutlinedButton(
                onClick = {
                    scope.launch {
                        LogCollector.clear()
                        snackbar.showSnackbar("日志已清空")
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) { Text("清空日志") }

            // 方案三：读取官方APP的BLE密钥（Shizuku 授权 / root 兜底）
            OutlinedButton(
                onClick = {
                    scope.launch {
                        LogCollector.log("UI", "用户点击读取官方密钥")
                        val reader = com.vibeqwen.glasses.util.ShizukuKeyReader
                        if (!reader.isShizukuAvailable() && !reader.hasRoot()) {
                            rfShowKeyResult = "Shizuku 未启动 / 无 root。\n请先启动 Shizuku（moe.shizuku.privileged.api）后重试。"
                        } else if (reader.isShizukuAvailable() && !reader.isGranted()) {
                            val ok = reader.requestPermission()
                            rfShowKeyResult = if (ok) {
                                "已发起 Shizuku 授权请求。\n请在系统弹窗中允许，然后再次点击「读取官方密钥」。"
                            } else {
                                "Shizuku 授权请求失败，请手动在 Shizuku 中授权本应用。"
                            }
                        } else {
                            LogCollector.log("UI", "Shizuku已授权/root可用，开始读取")
                            val result = reader.readOfficialBleKey()
                            rfShowKeyResult = result
                            LogCollector.log("UI", "读取结果: ${result.take(200)}")
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth()
            ) { Text("读取官方密钥 (Shizuku)") }
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

    // 密钥读取结果弹窗（Column 之外）
    if (rfShowKeyResult != null) {
        androidx.compose.material3.AlertDialog(
            onDismissRequest = { rfShowKeyResult = null },
            title = { Text("官方APP BLE 密钥") },
            text = {
                androidx.compose.foundation.text.selection.SelectionContainer {
                    Text(
                        rfShowKeyResult!!,
                        style = MaterialTheme.typography.bodySmall,
                        fontSize = 11.sp
                    )
                }
            },
            confirmButton = {
                androidx.compose.material3.TextButton(onClick = { rfShowKeyResult = null }) { Text("关闭") }
            }
        )
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
    HandshakeState.DEVICE_QUERY -> "问候"
    HandshakeState.WAIT_GLASSES_INFO -> "等待眼镜信息"
    HandshakeState.AUTH_SESSION -> "协商"
    HandshakeState.SN_AUTH -> "认证"
    HandshakeState.WAIT_ATTACH -> "等待确认"
    HandshakeState.READY -> "完成"
    HandshakeState.FAILED -> "失败"
}

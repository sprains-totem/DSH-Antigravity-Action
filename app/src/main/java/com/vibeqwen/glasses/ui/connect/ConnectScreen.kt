package com.vibeqwen.glasses.ui.connect

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Bluetooth
import androidx.compose.material.icons.filled.BluetoothDisabled
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vibeqwen.glasses.bluetooth.DeviceScanner
import com.vibeqwen.glasses.service.ConnectionState
import com.vibeqwen.glasses.service.GlassesBus
import com.vibeqwen.glasses.service.ServiceUiState

/**
 * 连接页：设备列表 + 连接状态。
 */
@Composable
fun ConnectScreen(
    vm: ConnectViewModel = viewModel(),
    onGoRecord: () -> Unit = {},
) {
    val context = LocalContext.current
    val state by GlassesBus.uiState.collectAsStateWithLifecycle()
    val devices by vm.devices.collectAsStateWithLifecycle()
    var rfShowKeyResult by remember { mutableStateOf<String?>(null) }

    LaunchedEffect(Unit) { vm.refresh(context) }

    Column(
        Modifier
            .fillMaxSize()
            .padding(16.dp)
            .verticalScroll(rememberScrollState())
    ) {
        ConnectionStatusCard(state)
        Spacer(Modifier.height(20.dp))

        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                "已配对设备",
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.weight(1f),
            )
            OutlinedButton(onClick = { vm.refresh(context) }) {
                Icon(Icons.Filled.Refresh, contentDescription = "刷新")
                Spacer(Modifier.width(4.dp))
                Text("刷新")
            }
        }
        Spacer(Modifier.height(8.dp))

        // 调试：导出 APP 内日志（连接/握手/协议）
        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.fillMaxWidth()) {
            OutlinedButton(onClick = { exportLogs(context) }, modifier = Modifier.weight(1f)) {
                Text("导出日志 (${com.vibeqwen.glasses.util.LogCollector.size()} 条)")
            }
            Spacer(Modifier.width(8.dp))
            OutlinedButton(onClick = { com.vibeqwen.glasses.util.LogCollector.clear() }, modifier = Modifier.weight(1f)) {
                Text("清空日志")
            }
        }
        Spacer(Modifier.height(8.dp))
        // 方案三：读取官方APP的BLE密钥（Shizuku 授权 / root 兜底）
        OutlinedButton(
            onClick = {
                val available = com.vibeqwen.glasses.util.ShizukuKeyReader.isShizukuAvailable()
                val granted = com.vibeqwen.glasses.util.ShizukuKeyReader.isGranted()
                val root = com.vibeqwen.glasses.util.ShizukuKeyReader.hasRoot()
                if (!available && !root) {
                    rfShowKeyResult = "Shizuku 未启动 / 无 root。\n请先启动 Shizuku（moe.shizuku.privileged.api）后重试。"
                } else if (available && !granted) {
                    val ok = com.vibeqwen.glasses.util.ShizukuKeyReader.requestPermission()
                    rfShowKeyResult = if (ok) {
                        "已发起 Shizuku 授权请求。\n请在系统弹窗中允许，然后再次点击「读取官方密钥」。"
                    } else {
                        "Shizuku 授权请求失败，请手动在 Shizuku 中授权本应用。"
                    }
                } else {
                    rfShowKeyResult = com.vibeqwen.glasses.util.ShizukuKeyReader.readOfficialBleKey()
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) { Text("读取官方密钥 (Shizuku)") }

        // BLE 扫描（官方 APP 特征：0xFEB3 + WoW/QWE）
        OutlinedButton(
            onClick = {
                val scanner = com.vibeqwen.glasses.bluetooth.BleGlassesScanner(context)
                var found = false
                scanner.scan(
                    durationMs = 8000,
                    onFound = { dev, adv ->
                        found = true
                        rfShowKeyResult = "BLE 发现眼镜:\n${dev.address}\n广播 ${adv.size} 字节\n详情见日志"
                    },
                    onDone = {
                        if (!found) {
                            rfShowKeyResult = "BLE 扫描完成，未发现 0xFEB3+WoW 设备。\n请确认眼镜开机且在附近。"
                        }
                    }
                )
            },
            modifier = Modifier.fillMaxWidth()
        ) { Text("BLE 扫描眼镜 (0xFEB3)") }

        // 密钥结果弹窗
        rfShowKeyResult?.let { result ->
            androidx.compose.material3.AlertDialog(
                onDismissRequest = { rfShowKeyResult = null },
                title = { Text("官方APP BLE 密钥") },
                text = {
                    androidx.compose.foundation.text.selection.SelectionContainer {
                        Text(result, style = MaterialTheme.typography.bodySmall, fontSize = 11.sp)
                    }
                },
                confirmButton = {
                    androidx.compose.material3.TextButton(onClick = { rfShowKeyResult = null }) { Text("关闭") }
                }
            )
        }
        Spacer(Modifier.height(8.dp))

        val hasPerm = ConnectViewModel.hasPermissions(context)
        if (!hasPerm) {
            Text(
                "缺少蓝牙/通知权限，请在系统设置中授予后重试",
                color = MaterialTheme.colorScheme.error,
                style = MaterialTheme.typography.bodySmall,
            )
            Spacer(Modifier.height(8.dp))
        }

        if (devices.isEmpty()) {
            Card(Modifier.fillMaxWidth()) {
                Box(Modifier.padding(20.dp), contentAlignment = Alignment.Center) {
                    Column(horizontalAlignment = Alignment.CenterHorizontally) {
                        Icon(
                            Icons.Filled.BluetoothDisabled,
                            contentDescription = null,
                            tint = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.height(8.dp))
                        Text(
                            "没有找到已配对设备\n请在系统蓝牙设置中先与眼镜配对（${com.vibeqwen.glasses.protocol.QwenConstants.GLASSES_MAC}）",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
            }
        } else {
            devices.forEach { device ->
                DeviceRow(device, onConnect = { vm.connect(context, device.mac) })
            }
        }

        Spacer(Modifier.height(20.dp))

        // 已连接时提供"前往录音"入口
        if (state.connection == ConnectionState.READY || state.recording) {
            Button(
                onClick = onGoRecord,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text(if (state.recording) "正在录音 — 前往查看" else "已就绪 — 前往录音")
            }
        } else if (state.connection != ConnectionState.DISCONNECTED && state.connection != ConnectionState.ERROR) {
            OutlinedButton(
                onClick = { vm.disconnect(context) },
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("断开连接")
            }
        }
    }
}

@Composable
private fun ConnectionStatusCard(state: ServiceUiState) {
    val (tint, label) = when (state.connection) {
        ConnectionState.DISCONNECTED -> MaterialTheme.colorScheme.onSurfaceVariant to "未连接"
        ConnectionState.CONNECTING -> MaterialTheme.colorScheme.primary to "连接中…"
        ConnectionState.HANDSHAKING -> MaterialTheme.colorScheme.primary to "握手认证中…"
        ConnectionState.READY -> MaterialTheme.colorScheme.primary to "已就绪"
        ConnectionState.ERROR -> MaterialTheme.colorScheme.error to "连接异常"
    }
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Column(Modifier.padding(16.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(
                    Icons.Filled.Bluetooth,
                    contentDescription = null,
                    tint = tint,
                )
                Spacer(Modifier.width(10.dp))
                Text(
                    label,
                    style = MaterialTheme.typography.titleMedium,
                    color = tint,
                )
                if (state.connection == ConnectionState.CONNECTING ||
                    state.connection == ConnectionState.HANDSHAKING
                ) {
                    Spacer(Modifier.width(8.dp))
                    CircularProgressIndicator(Modifier.height(18.dp).width(18.dp), strokeWidth = 2.dp)
                }
            }
            state.deviceName?.let {
                Spacer(Modifier.height(6.dp))
                Text("设备：$it ${state.deviceMac.orEmpty()}", style = MaterialTheme.typography.bodySmall)
            }
            state.message?.let {
                Spacer(Modifier.height(6.dp))
                Text(it, style = MaterialTheme.typography.bodySmall)
            }
            state.lastError?.let {
                Spacer(Modifier.height(6.dp))
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
        }
    }
}

@Composable
private fun DeviceRow(
    device: DeviceScanner.GlassesDevice,
    onConnect: () -> Unit,
) {
    val isGlasses = DeviceScanner.isLikelyGlasses(device.name, device.mac)
    Surface(
        shape = MaterialTheme.shapes.medium,
        color = if (isGlasses) MaterialTheme.colorScheme.primaryContainer
        else MaterialTheme.colorScheme.surface,
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
    ) {
        Row(
            Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Icon(
                Icons.Filled.Bluetooth,
                contentDescription = null,
                tint = if (isGlasses) MaterialTheme.colorScheme.onPrimaryContainer
                else MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f)) {
                Text(
                    device.name?.takeIf { it.isNotBlank() } ?: "(无名设备)",
                    style = MaterialTheme.typography.bodyLarge,
                )
                Text(
                    "${device.mac}${if (isGlasses) " · 眼镜" else ""}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Button(
                onClick = onConnect,
                enabled = ConnectViewModel.hasPermissions(LocalContext.current),
            ) {
                Text("连接")
            }
        }
    }
}

/** 导出并分享 APP 内日志 */
private fun exportLogs(context: android.content.Context) {
    com.vibeqwen.glasses.util.LogCollector.log("UI", "用户点击导出日志")
    val file = com.vibeqwen.glasses.util.LogCollector.export(context)
    if (file != null) {
        com.vibeqwen.glasses.util.LogCollector.log("UI", "日志已导出: ${file.absolutePath}")
        try {
            val uri = androidx.core.content.FileProvider.getUriForFile(
                context, context.packageName + ".fileprovider", file
            )
            val intent = android.content.Intent(android.content.Intent.ACTION_SEND).apply {
                type = "text/plain"
                putExtra(android.content.Intent.EXTRA_STREAM, uri)
                addFlags(android.content.Intent.FLAG_GRANT_READ_URI_PERMISSION)
            }
            context.startActivity(android.content.Intent.createChooser(intent, "分享日志"))
        } catch (_: Exception) {
            // FileProvider 未覆盖路径时仅提示文件位置
        }
    }
}
package com.vibeqwen.glasses

import android.Manifest
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Storage
import androidx.compose.material.icons.filled.Bluetooth
import com.vibeqwen.glasses.ui.connect.ConnectScreen
import com.vibeqwen.glasses.ui.record.RecordScreen
import com.vibeqwen.glasses.ui.recordings.RecordingsScreen
import com.vibeqwen.glasses.ui.theme.VibeQwenTheme

class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            VibeQwenTheme {
                MainRoot()
            }
        }
    }
}

private data class Tab(val label: String, val icon: ImageVector)

@Composable
private fun MainRoot() {
    val tabs = listOf(
        Tab("连接", Icons.Filled.Bluetooth),
        Tab("录音", Icons.Filled.Mic),
        Tab("列表", Icons.Filled.Storage)
    )
    var current by remember { mutableStateOf(0) }

    // 运行时权限申请（蓝牙 + 通知 + 定位）
    val permissions = buildList {
        add(Manifest.permission.BLUETOOTH_CONNECT)
        if (Build.VERSION.SDK_INT >= 31) {
            add(Manifest.permission.BLUETOOTH_SCAN)
        } else {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
        }
        if (Build.VERSION.SDK_INT >= 33) {
            add(Manifest.permission.POST_NOTIFICATIONS)
        }
    }
    val launcher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { /* 结果在连接时实际生效，这里仅预申请 */ }
    androidx.compose.runtime.LaunchedEffect(Unit) {
        launcher.launch(permissions.toTypedArray())
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                tabs.forEachIndexed { index, tab ->
                    NavigationBarItem(
                        selected = current == index,
                        onClick = { current = index },
                        icon = { androidx.compose.material3.Icon(tab.icon, contentDescription = tab.label) },
                        label = { Text(tab.label) }
                    )
                }
            }
        }
    ) { inner ->
        when (current) {
            0 -> ConnectScreen(Modifier.fillMaxSize().padding(inner))
            1 -> RecordScreen(Modifier.fillMaxSize().padding(inner))
            2 -> RecordingsScreen(Modifier.fillMaxSize().padding(inner))
        }
    }
}

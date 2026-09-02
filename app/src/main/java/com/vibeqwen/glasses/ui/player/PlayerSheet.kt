package com.vibeqwen.glasses.ui.player

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.FastForward
import androidx.compose.material.icons.filled.FastRewind
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vibeqwen.glasses.audio.RecordingFileManager.RecordingInfo
import com.vibeqwen.glasses.ui.components.WaveformBar
import com.vibeqwen.glasses.util.TimeFormat

/**
 * 播放器底部弹层：变速(0.5-2.0x) / ±10s 跳转 / 循环 / 波形进度。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerSheet(
    info: RecordingInfo,
    onDismiss: () -> Unit,
    vm: PlayerViewModel = viewModel(factory = PlayerViewModelFactory(info)),
) {
    val ui by vm.ui.collectAsStateWithLifecycle()

    androidx.compose.material3.ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 36.dp),
        ) {
            Text(
                info.displayName,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
            )
            Spacer(Modifier.height(4.dp))
            Text(
                "${TimeFormat.clock(ui.positionMs)} / ${TimeFormat.clock(ui.durationMs)}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(10.dp))

            // 波形 + 进度
            WaveformBar(
                values = ui.peaks.toList(),
                modifier = Modifier
                    .fillMaxWidth()
                    .height(72.dp),
            )
            Slider(
                value = ui.positionMs.toFloat(),
                onValueChange = { vm.seekTo(it.toLong()) },
                valueRange = 0f..ui.durationMs.coerceAtLeast(1).toFloat(),
                modifier = Modifier.fillMaxWidth(),
            )

            Spacer(Modifier.height(4.dp))

            // 控制行
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceEvenly,
                modifier = Modifier.fillMaxWidth(),
            ) {
                // 循环
                IconButton(onClick = { vm.toggleLoop() }) {
                    Icon(
                        Icons.Filled.Repeat,
                        contentDescription = "循环",
                        tint = if (ui.loop) MaterialTheme.colorScheme.primary
                        else MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                // -10s
                FilledIconButton(onClick = { vm.skip(-10_000) }) {
                    Icon(Icons.Filled.FastRewind, contentDescription = "后退10秒")
                }
                // 播放/暂停
                FilledIconButton(onClick = { vm.playPause() }) {
                    Icon(
                        if (ui.isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                        contentDescription = "播放/暂停",
                    )
                }
                // +10s
                FilledIconButton(onClick = { vm.skip(10_000) }) {
                    Icon(Icons.Filled.FastForward, contentDescription = "前进10秒")
                }
                // 变速
                OutlinedButton(onClick = {}) {
                    Text("${ui.speed}x".replace(".0x", "x"))
                }
            }

            Spacer(Modifier.height(4.dp))

            // 变速按钮组
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.fillMaxWidth(),
            ) {
                listOf(0.5f, 0.75f, 1f, 1.5f, 2f).forEach { speed ->
                    Button(
                        onClick = { vm.setSpeed(speed) },
                        enabled = ui.speed != speed,
                        modifier = Modifier.weight(1f),
                    ) {
                        Text(if (speed == 1f) "1x" else "${speed}x")
                    }
                }
            }

            ui.error?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }
        }
    }
}

/** 为 PlayerSheet 构造带参数的 ViewModel */
internal class PlayerViewModelFactory(private val info: RecordingInfo) :
    androidx.lifecycle.ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : androidx.lifecycle.ViewModel> create(modelClass: Class<T>): T =
        PlayerViewModel(info) as T
}
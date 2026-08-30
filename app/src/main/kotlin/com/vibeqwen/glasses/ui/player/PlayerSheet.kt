package com.vibeqwen.glasses.ui.player

import android.content.Context
import android.media.MediaPlayer
import android.media.PlaybackParams
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Repeat
import androidx.compose.material.icons.filled.RepeatOn
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import com.vibeqwen.glasses.model.RecordingItem
import kotlinx.coroutines.delay
import java.io.File

/**
 * 录音播放器（底部弹层）：变速 0.5x–2.0x、±10s 跳转、循环、进度条。
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PlayerSheet(item: RecordingItem, onDismiss: () -> Unit) {
    val sheetState = rememberModalBottomSheetState()
    ModalBottomSheet(onDismissRequest = onDismiss, sheetState = sheetState) {
        PlayerContent(item = item, context = LocalContext.current)
    }
}

@Composable
private fun PlayerContent(item: RecordingItem, context: Context) {
    val player = remember { MediaPlayer() }

    var isPlaying by remember { mutableStateOf(false) }
    var positionMs by remember { mutableFloatStateOf(0f) }
    var durationMs by remember { mutableFloatStateOf(0f) }
    var speed by remember { mutableStateOf(1.0f) }
    var loop by remember { mutableStateOf(false) }

    val speeds = listOf(0.5f, 0.75f, 1.0f, 1.25f, 1.5f, 1.75f, 2.0f)

    DisposableEffect(Unit) {
        player.setOnPreparedListener { mp -> durationMs = mp.duration.toFloat() }
        player.setOnCompletionListener {
            isPlaying = false
            if (!loop) positionMs = durationMs
        }
        val uri = FileProvider.getUriForFile(
            context,
            context.packageName + ".fileprovider",
            File(item.path)
        )
        player.setDataSource(context, uri)
        player.prepareAsync()
        onDispose { player.release() }
    }

    // 进度轮询
    LaunchedEffect(isPlaying) {
        if (isPlaying) {
            while (true) {
                delay(200)
                if (player.isPlaying) positionMs = player.currentPosition.toFloat()
            }
        }
    }

    fun applySpeed() {
        runCatching {
            player.playbackParams = PlaybackParams().setSpeed(speed)
        }
    }

    Column(Modifier.fillMaxWidth().padding(16.dp)) {
        Text(item.displayName, style = MaterialTheme.typography.titleMedium)
        Text(
            "${fmt(positionMs.toInt())} / ${fmt(durationMs.toInt())}",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Slider(
            value = positionMs,
            valueRange = 0f..durationMs.coerceAtLeast(1f),
            onValueChange = {
                positionMs = it
                runCatching { player.seekTo(it.toInt()) }
            }
        )

        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceEvenly,
            verticalAlignment = Alignment.CenterVertically
        ) {
            IconButton(onClick = {
                val target = (positionMs - 10000f).coerceAtLeast(0f)
                positionMs = target
                runCatching { player.seekTo(target.toInt()) }
            }) { Text("-10s") }

            IconButton(onClick = {
                if (player.isPlaying) {
                    player.pause()
                    isPlaying = false
                } else {
                    player.start()
                    applySpeed()
                    isPlaying = true
                }
            }) {
                Icon(
                    if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                    contentDescription = "播放/暂停"
                )
            }

            IconButton(onClick = {
                val target = (positionMs + 10000f).coerceAtMost(durationMs)
                positionMs = target
                runCatching { player.seekTo(target.toInt()) }
            }) { Text("+10s") }

            IconButton(onClick = {
                loop = !loop
                player.isLooping = loop
            }) {
                Icon(
                    if (loop) Icons.Filled.RepeatOn else Icons.Filled.Repeat,
                    contentDescription = "循环"
                )
            }

            Button(onClick = {
                speed = speeds[(speeds.indexOf(speed) + 1) % speeds.size]
                applySpeed()
            }) { Text("${speed}x") }
        }
    }
}

private fun fmt(ms: Int): String {
    val total = ms / 1000
    val m = total / 60
    val s = total % 60
    return "%02d:%02d".format(m, s)
}

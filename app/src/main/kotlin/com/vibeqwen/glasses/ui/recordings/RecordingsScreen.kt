package com.vibeqwen.glasses.ui.recordings

import android.content.Context
import android.content.Intent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Card
import androidx.compose.material3.FilledIconButton
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.FileProvider
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vibeqwen.glasses.model.RecordingItem
import com.vibeqwen.glasses.ui.player.PlayerSheet
import java.io.File

@Composable
fun RecordingsScreen(
    modifier: Modifier = Modifier,
    vm: RecordingsViewModel = viewModel()
) {
    val items by vm.recordings.collectAsStateWithLifecycle()
    var selected by remember { mutableStateOf<RecordingItem?>(null) }

    Column(modifier.padding(16.dp)) {
        Text("我的录音", style = MaterialTheme.typography.titleLarge)
        if (items.isEmpty()) {
            Column(
                Modifier.fillMaxSize().weight(1f),
                verticalArrangement = Arrangement.Center,
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Text("还没有录音。去「录音」页开始吧。", color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        } else {
            LazyColumn(Modifier.fillMaxSize().weight(1f)) {
                items(items) { item ->
                    RecordingRow(
                        item = item,
                        onPlay = { selected = item },
                        onDelete = { vm.delete(item.path) },
                        onShare = { shareRecording(it, item.path) }
                    )
                }
            }
        }
    }

    selected?.let { item ->
        PlayerSheet(item = item, onDismiss = { selected = null })
    }
}

@Composable
private fun RecordingRow(
    item: RecordingItem,
    onPlay: () -> Unit,
    onDelete: () -> Unit,
    onShare: (Context) -> Unit
) {
    val context = LocalContext.current
    Card(Modifier.fillMaxWidth().padding(vertical = 4.dp)) {
        Row(
            Modifier.fillMaxWidth().padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            Column(Modifier.weight(1f)) {
                Text(item.displayName, style = MaterialTheme.typography.bodyLarge)
                Text(
                    "${formatDuration(item.durationSec)} · ${item.sizeKb} KB",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
            FilledIconButton(onClick = onPlay) {
                Icon(Icons.Filled.PlayArrow, contentDescription = "播放")
            }
            IconButton(onClick = { onShare(context) }) {
                Icon(Icons.Filled.Share, contentDescription = "分享")
            }
            IconButton(onClick = onDelete) {
                Icon(Icons.Filled.Delete, contentDescription = "删除")
            }
        }
    }
}

private fun shareRecording(context: Context, path: String) {
    val file = File(path)
    if (!file.exists()) return
    val uri = FileProvider.getUriForFile(
        context,
        context.packageName + ".fileprovider",
        file
    )
    val intent = Intent(Intent.ACTION_SEND).apply {
        type = "audio/wav"
        putExtra(Intent.EXTRA_STREAM, uri)
        addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "分享录音"))
}

private fun formatDuration(sec: Int): String {
    val m = sec / 60
    val s = sec % 60
    return "%02d:%02d".format(m, s)
}

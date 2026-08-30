package com.vibeqwen.glasses.ui.record

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.vibeqwen.glasses.ConnectionState
import com.vibeqwen.glasses.RecordingState
import kotlinx.coroutines.delay

@Composable
fun RecordScreen(
    modifier: Modifier = Modifier,
    vm: RecordViewModel = viewModel()
) {
    val snackbar = remember { SnackbarHostState() }
    val recState by vm.recordingState.collectAsStateWithLifecycle()
    val connState by vm.connectionState.collectAsStateWithLifecycle()
    val db by vm.db.collectAsStateWithLifecycle()

    val points = remember { mutableStateListOf<Float>() }
    var elapsedSec by remember { mutableIntStateOf(0) }

    // 实时波形：把幅度流累积到环形缓冲
    LaunchedEffect(Unit) {
        vm.amplitude.collect { v ->
            points.add(v)
            if (points.size > 240) points.removeAt(0)
        }
    }
    // 录音计时
    LaunchedEffect(recState) {
        if (recState == RecordingState.RECORDING) {
            elapsedSec = 0
            while (true) {
                delay(1000)
                elapsedSec++
            }
        }
    }
    // 停止后清空波形
    LaunchedEffect(recState) {
        if (recState != RecordingState.RECORDING && points.isNotEmpty()) {
            points.clear()
        }
    }
    // 瞬时消息
    LaunchedEffect(Unit) { vm.toast.collect { snackbar.showSnackbar(it) } }

    val ready = connState == ConnectionState.READY || connState == ConnectionState.CONNECTED
    val recording = recState == RecordingState.RECORDING

    Column(
        modifier.padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text("录音", style = MaterialTheme.typography.titleLarge)
        Spacer(Modifier.height(8.dp))
        Text(
            if (recording) "录音中 ${formatDuration(elapsedSec)}" else "准备就绪",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )
        Text(
            if (db.isFinite()) "%.1f dB".format(db) else "-∞ dB",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant
        )

        Spacer(Modifier.height(16.dp))

        // 实时波形
        val primaryColor = MaterialTheme.colorScheme.primary
        Canvas(
            Modifier.fillMaxWidth().height(120.dp)
                .clip(androidx.compose.foundation.shape.RoundedCornerShape(12.dp))
        ) {
            val w = size.width
            val h = size.height
            val n = points.size
            if (n > 0) {
                val step = w / n
                for (i in 0 until n) {
                    val a = points[i]
                    val barH = (a * h * 0.9f).coerceAtLeast(2f)
                    val x = i * step + step / 2
                    drawLine(
                        color = primaryColor,
                        start = Offset(x, h / 2 - barH / 2),
                        end = Offset(x, h / 2 + barH / 2),
                        strokeWidth = (step * 0.6f).coerceAtLeast(1f)
                    )
                }
            }
        }

        Spacer(Modifier.height(24.dp))

        // 大录音按钮
        Box(contentAlignment = Alignment.Center) {
            Button(
                onClick = { vm.toggleRecord() },
                enabled = ready || recording,
                modifier = Modifier.size(140.dp).clip(CircleShape),
                colors = androidx.compose.material3.ButtonDefaults.buttonColors(
                    containerColor = if (recording) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
                    contentColor = Color.White,
                    disabledContainerColor = MaterialTheme.colorScheme.surfaceVariant,
                    disabledContentColor = MaterialTheme.colorScheme.onSurfaceVariant
                )
            ) {
                Text(
                    if (recording) "停止" else "开始录音",
                    fontSize = 18.sp
                )
            }
        }

        Spacer(Modifier.height(16.dp))
        if (!ready && !recording) {
            Text(
                "请先在「连接」页连接眼镜并完成握手",
                color = MaterialTheme.colorScheme.error
            )
        }

        Spacer(Modifier.height(8.dp))
        Row(
            Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.Center
        ) {
            Text(
                "采样率 16kHz · 单声道 · PCM（眼镜私有协议）",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
    }

    SnackbarHost(snackbar, modifier = Modifier.fillMaxSize())
}

private fun formatDuration(sec: Int): String {
    val m = sec / 60
    val s = sec % 60
    return "%02d:%02d".format(m, s)
}

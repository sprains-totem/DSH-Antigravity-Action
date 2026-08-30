package com.vibeqwen.glasses.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.os.PowerManager
import androidx.core.app.ServiceCompat
import com.vibeqwen.glasses.ConnectionController
import com.vibeqwen.glasses.GlassesApp
import com.vibeqwen.glasses.MainActivity
import com.vibeqwen.glasses.R

/**
 * 前台服务：录音期间的进程保活 + 通知栏状态 + WakeLock。
 *
 * 逻辑所有权在 [ConnectionController]，本服务只负责「前台化」表现层：
 *  - startRecordingForeground()：startForeground + 申请 PARTIAL_WAKE_LOCK；
 *  - stopRecordingForeground()：停止前台 + 释放 WakeLock。
 * 当录音由眼镜侧发起时，控制器也会调用本服务拉起前台。
 */
class GlassesConnectionService : Service() {

    private val controller: ConnectionController
        get() = (application as GlassesApp).controller

    private var wakeLock: PowerManager.WakeLock? = null

    override fun onCreate() {
        super.onCreate()
        controller.attachService(this)
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        // 服务被拉起时若已在录音，立即进入前台
        if (controller.recordingState.value == com.vibeqwen.glasses.RecordingState.RECORDING) {
            startRecordingForeground()
        }
        return START_STICKY
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onDestroy() {
        stopRecordingForeground()
        controller.detachService()
        super.onDestroy()
    }

    fun startRecordingForeground() {
        val nm = getSystemService(NotificationManager::class.java)
        if (Build.VERSION.SDK_INT >= 26) {
            val chan = NotificationChannel(
                CHANNEL_ID, "眼镜录音", NotificationManager.IMPORTANCE_LOW
            ).apply { description = "千问 G1 眼镜录音进行中" }
            nm.createNotificationChannel(chan)
        }
        val notification = buildNotification("正在通过千问 G1 眼镜录音…")
        // 声明 connectedDevice 前台服务类型（录音走蓝牙连接设备）
        ServiceCompat.startForeground(
            this, NOTIF_ID, notification,
            if (Build.VERSION.SDK_INT >= 30) ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE else 0
        )
        acquireWakeLock()
    }

    fun stopRecordingForeground() {
        releaseWakeLock()
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
    }

    private fun buildNotification(text: String): Notification {
        val contentIntent = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE
        )
        val builder = if (Build.VERSION.SDK_INT >= 26) {
            Notification.Builder(this, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(this)
        }
        return builder
            .setContentTitle("vibeQwenGlasses")
            .setContentText(text)
            .setSmallIcon(R.drawable.ic_notif)
            .setContentIntent(contentIntent)
            .setOngoing(true)
            .build()
    }

    private fun acquireWakeLock() {
        if (wakeLock?.isHeld == true) return
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "vibeQwen::recording"
        ).apply { acquire(6L * 60 * 60 * 1000) } // 最长 6h，停止时释放
    }

    private fun releaseWakeLock() {
        if (wakeLock?.isHeld == true) wakeLock?.release()
        wakeLock = null
    }

    companion object {
        const val NOTIF_ID = 1001
        const val CHANNEL_ID = "vibeQwen.recording"
    }
}

package com.vibeqwen.glasses

import android.app.Application

/**
 * Application 入口：持有全局唯一的 [ConnectionController]（单进程状态中枢）。
 */
class GlassesApp : Application() {

    lateinit var controller: ConnectionController
        private set

    override fun onCreate() {
        super.onCreate()
        controller = ConnectionController(this)
    }
}

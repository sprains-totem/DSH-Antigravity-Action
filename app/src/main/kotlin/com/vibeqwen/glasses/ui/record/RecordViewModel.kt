package com.vibeqwen.glasses.ui.record

import androidx.lifecycle.AndroidViewModel
import com.vibeqwen.glasses.ConnectionController
import com.vibeqwen.glasses.GlassesApp
import com.vibeqwen.glasses.RecordingState
import kotlinx.coroutines.flow.StateFlow
import com.vibeqwen.glasses.ConnectionState

/**
 * 录音页 ViewModel：桥接 [ConnectionController] 的录音/连接状态。
 */
class RecordViewModel(app: android.app.Application) : AndroidViewModel(app) {

    private val controller = (app as GlassesApp).controller

    val recordingState: StateFlow<RecordingState> = controller.recordingState
    val connectionState: StateFlow<ConnectionState> = controller.connectionState
    val amplitude = controller.amplitude
    val db = controller.db
    val toast = controller.toastEvents

    fun toggleRecord() {
        if (controller.recordingState.value == RecordingState.RECORDING) {
            controller.stopRecording()
        } else {
            controller.startRecording()
        }
    }
}

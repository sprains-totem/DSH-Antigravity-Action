package com.vibeqwen.glasses.ui.record

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vibeqwen.glasses.service.GlassesBus
import com.vibeqwen.glasses.service.GlassesConnectionService
import com.vibeqwen.glasses.service.ServiceUiState
import kotlinx.coroutines.flow.StateFlow

/**
 * 录音页 ViewModel：透传服务状态 + 录音动作。
 */
class RecordViewModel : ViewModel() {

    val state: StateFlow<ServiceUiState> = GlassesBus.uiState
    val waveform: StateFlow<List<Float>> = GlassesBus.waveform

    fun startRecording(context: Context) {
        GlassesConnectionService.startRecord(context)
    }

    fun stopRecording(context: Context) {
        GlassesConnectionService.stopRecord(context)
    }
}
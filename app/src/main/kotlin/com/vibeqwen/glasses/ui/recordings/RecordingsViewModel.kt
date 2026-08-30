package com.vibeqwen.glasses.ui.recordings

import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.vibeqwen.glasses.ConnectionController
import com.vibeqwen.glasses.GlassesApp
import com.vibeqwen.glasses.model.RecordingItem
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 录音列表页 ViewModel：读取 [ConnectionController.recordingsDir] 下的 WAV 切片。
 */
class RecordingsViewModel(app: android.app.Application) : AndroidViewModel(app) {

    private val controller = (app as GlassesApp).controller

    private val _recordings = MutableStateFlow<List<RecordingItem>>(emptyList())
    val recordings: StateFlow<List<RecordingItem>> = _recordings.asStateFlow()

    init {
        reload()
        viewModelScope.launch {
            controller.recordingsChanged.collect { reload() }
        }
    }

    fun reload() {
        _recordings.value = controller.listRecordings()
    }

    fun delete(path: String) {
        controller.deleteRecording(path)
        reload()
    }
}

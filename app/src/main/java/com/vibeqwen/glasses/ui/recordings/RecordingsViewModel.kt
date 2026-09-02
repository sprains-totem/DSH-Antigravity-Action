package com.vibeqwen.glasses.ui.recordings

import android.content.Context
import android.content.Intent
import androidx.core.content.ContextCompat
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.vibeqwen.glasses.audio.RecordingFileManager
import com.vibeqwen.glasses.audio.RecordingFileManager.RecordingInfo
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

/**
 * 录音库 ViewModel：列表 / 删除 / 分享 / 待播放选中项。
 */
class RecordingsViewModel : ViewModel() {

    private val _recordings = MutableStateFlow<List<RecordingInfo>>(emptyList())
    val recordings: StateFlow<List<RecordingInfo>> = _recordings.asStateFlow()

    private val _playing = MutableStateFlow<RecordingInfo?>(null)
    val playing: StateFlow<RecordingInfo?> = _playing.asStateFlow()

    fun refresh(context: Context) {
        viewModelScope.launch {
            _recordings.value = RecordingFileManager.listRecordings(context)
        }
    }

    fun delete(context: Context, info: RecordingInfo): Boolean {
        val ok = RecordingFileManager.delete(info.file)
        if (ok) refresh(context)
        return ok
    }

    fun play(info: RecordingInfo) {
        _playing.value = info
    }

    fun dismissPlayer() {
        _playing.value = null
    }

    /** 通过 FileProvider 分享 */
    fun share(context: Context, info: RecordingInfo) {
        val uri = RecordingFileManager.shareUri(context, info.file)
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = RecordingFileManager.mimeFor(info.file)
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        ContextCompat.startActivity(
            context,
            Intent.createChooser(intent, "分享 ${info.displayName}"),
            null,
        )
    }
}
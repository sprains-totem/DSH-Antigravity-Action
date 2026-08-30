package com.vibeqwen.glasses.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** 深色音频风格主题 */
private val DarkColorScheme = darkColorScheme(
    primary = Color(0xFF7C4DFF),
    secondary = Color(0xFFB39DFF),
    tertiary = Color(0xFF4DD0E1),
    background = Color(0xFF0E0E12),
    surface = Color(0xFF16161C),
    surfaceVariant = Color(0xFF1F1F27),
    onPrimary = Color.White,
    onBackground = Color(0xFFEDEDF2),
    onSurface = Color(0xFFEDEDF2),
    onSurfaceVariant = Color(0xFFB8B8C4),
    error = Color(0xFFFF6E6E)
)

@Composable
fun VibeQwenTheme(content: @Composable () -> Unit) {
    val scheme = if (isSystemInDarkTheme()) DarkColorScheme else DarkColorScheme
    MaterialTheme(
        colorScheme = scheme,
        typography = androidx.compose.material3.MaterialTheme.typography,
        content = content
    )
}

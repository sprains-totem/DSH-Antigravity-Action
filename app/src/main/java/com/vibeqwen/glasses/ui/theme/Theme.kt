package com.vibeqwen.glasses.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// ── 深色音频风格配色 ──
val CyanPrimary = Color(0xFF4DD8E0)
val CyanContainer = Color(0xFF12343B)
val TealAccent = Color(0xFF7EE8FA)
val VioletAccent = Color(0xFF9D7BFF)
val BgDeep = Color(0xFF070B14)
val SurfaceDark = Color(0xFF101827)
val SurfaceHigh = Color(0xFF1A2436)
val TextPrimary = Color(0xFFE8F0FB)
val TextSecondary = Color(0xFF8FA3BD)
val Danger = Color(0xFFFF5C6C)

private val DarkColors = darkColorScheme(
    primary = CyanPrimary,
    onPrimary = Color(0xFF001F24),
    primaryContainer = CyanContainer,
    onPrimaryContainer = TealAccent,
    secondary = VioletAccent,
    background = BgDeep,
    onBackground = TextPrimary,
    surface = SurfaceDark,
    onSurface = TextPrimary,
    surfaceVariant = SurfaceHigh,
    onSurfaceVariant = TextSecondary,
    error = Danger,
    onError = Color(0xFFFFFFFF),
)

/** 应用主题：深色音频风 */
@Composable
fun VibeQwenTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = DarkColors,
        content = content,
    )
}
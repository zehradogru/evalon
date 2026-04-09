package com.evalon.shared.presentation.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable

private val DarkColorScheme = darkColorScheme(
    primary = EvalonBlue,
    secondary = EvalonOrange,
    tertiary = EvalonGreen,
    background = EvalonDarkBg,
    surface = EvalonDarkSurface,
    surfaceVariant = EvalonSurfaceVariant,
    error = EvalonRed,
    onPrimary = EvalonTextPrimary,
    onSecondary = EvalonTextPrimary,
    onBackground = EvalonTextPrimary,
    onSurface = EvalonTextPrimary,
    onError = EvalonTextPrimary
)

@Composable
fun EvalonTheme(
    content: @Composable () -> Unit
) {
    MaterialTheme(
        colorScheme = DarkColorScheme,
        typography = Typography,
        content = content
    )
}

package com.evalon.shared.presentation.screens.splash

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.draw.blur
import androidx.compose.ui.draw.scale
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.presentation.ui.theme.EvalonBlue
import com.evalon.shared.presentation.ui.theme.EvalonBlueDark
import com.evalon.shared.presentation.ui.theme.EvalonTextSecondary
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(component: SplashComponent) {

    // Animation states
    val transitionState = remember { MutableTransitionState(false) }
    transitionState.targetState = true

    val transition = updateTransition(transitionState, label = "SplashTransition")

    // Ana metin: scale + fade
    val titleScale by transition.animateFloat(
        transitionSpec = { tween(durationMillis = 800, easing = FastOutSlowInEasing) },
        label = "TitleScale"
    ) { if (it) 1f else 0.8f }

    val titleAlpha by transition.animateFloat(
        transitionSpec = { tween(durationMillis = 800) },
        label = "TitleAlpha"
    ) { if (it) 1f else 0f }

    // Glow efekti: gecikmeli fade
    val glowAlpha by transition.animateFloat(
        transitionSpec = { tween(durationMillis = 1000, delayMillis = 400) },
        label = "GlowAlpha"
    ) { if (it) 0.6f else 0f }

    // Alt metin: gecikmeli fade
    val subtitleAlpha by transition.animateFloat(
        transitionSpec = { tween(durationMillis = 600, delayMillis = 600) },
        label = "SubtitleAlpha"
    ) { if (it) 1f else 0f }

    // Pulsing dot animation
    val infiniteTransition = rememberInfiniteTransition(label = "pulse")

    // 3 saniye sonra ana ekrana geç
    LaunchedEffect(Unit) {
        delay(3000)
        component.onSplashFinished()
    }

    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(
                Brush.radialGradient(
                    colors = listOf(
                        Color(0xFF0A0A1A),
                        Color(0xFF050510),
                        Color(0xFF000000)
                    ),
                    radius = 1200f
                )
            ),
        contentAlignment = Alignment.Center
    ) {
        // Glow efekti — metnin arkasında
        Box(
            modifier = Modifier
                .size(200.dp)
                .alpha(glowAlpha)
                .blur(80.dp)
                .background(
                    Brush.radialGradient(
                        colors = listOf(
                            EvalonBlue.copy(alpha = 0.3f),
                            EvalonBlueDark.copy(alpha = 0.1f),
                            Color.Transparent
                        )
                    )
                )
        )

        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center
        ) {
            // App Name — Premium kalın yazı
            Text(
                text = "EVALON",
                fontSize = 42.sp,
                fontWeight = FontWeight.Black,
                color = Color.White,
                letterSpacing = 10.sp,
                modifier = Modifier
                    .scale(titleScale)
                    .alpha(titleAlpha)
            )

            Spacer(modifier = Modifier.height(12.dp))

            // Tagline
            Text(
                text = "Smart Trading Platform",
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                color = EvalonTextSecondary,
                letterSpacing = 3.sp,
                modifier = Modifier.alpha(subtitleAlpha)
            )
        }

        // Loading indicator — pulsing dots at bottom
        Box(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 64.dp)
        ) {
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.alpha(subtitleAlpha)
            ) {
                repeat(3) { index ->
                    val individualAlpha by infiniteTransition.animateFloat(
                        initialValue = 0.2f,
                        targetValue = 1f,
                        animationSpec = infiniteRepeatable(
                            animation = tween(700, delayMillis = index * 200, easing = FastOutSlowInEasing),
                            repeatMode = RepeatMode.Reverse
                        ),
                        label = "dot$index"
                    )
                    Box(
                        modifier = Modifier
                            .size(5.dp)
                            .alpha(individualAlpha)
                            .background(EvalonBlue, shape = CircleShape)
                    )
                }
            }
        }
    }
}

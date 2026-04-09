package com.evalon.shared.presentation.components

import androidx.compose.animation.core.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.evalon.shared.presentation.ui.theme.EvalonSurfaceVariant

@Composable
fun EvalonLoadingState(
    modifier: Modifier = Modifier,
    itemCount: Int = 5
) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        repeat(itemCount) {
            ShimmerRow()
        }
    }
}

@Composable
private fun ShimmerRow() {
    val shimmerColors = listOf(
        EvalonSurfaceVariant.copy(alpha = 0.3f),
        EvalonSurfaceVariant.copy(alpha = 0.5f),
        EvalonSurfaceVariant.copy(alpha = 0.3f)
    )

    val transition = rememberInfiniteTransition(label = "shimmer")
    val translateAnim by transition.animateFloat(
        initialValue = 0f,
        targetValue = 1000f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1200, easing = FastOutSlowInEasing),
            repeatMode = RepeatMode.Restart
        ),
        label = "shimmer_translate"
    )

    val brush = Brush.linearGradient(
        colors = shimmerColors,
        start = Offset.Zero,
        end = Offset(x = translateAnim, y = translateAnim)
    )

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(vertical = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp)
    ) {
        // Avatar placeholder
        ShimmerBox(width = 44.dp, height = 44.dp, brush = brush)

        Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            ShimmerBox(width = 100.dp, height = 14.dp, brush = brush)
            ShimmerBox(width = 160.dp, height = 12.dp, brush = brush)
        }

        Column(
            verticalArrangement = Arrangement.spacedBy(6.dp)
        ) {
            ShimmerBox(width = 60.dp, height = 14.dp, brush = brush)
            ShimmerBox(width = 48.dp, height = 12.dp, brush = brush)
        }
    }
}

@Composable
private fun ShimmerBox(width: Dp, height: Dp, brush: Brush) {
    Spacer(
        modifier = Modifier
            .width(width)
            .height(height)
            .clip(RoundedCornerShape(6.dp))
            .background(brush)
    )
}

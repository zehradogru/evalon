package com.evalon.shared.presentation.screens.stockdetail

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.domain.model.Timeframe
import com.evalon.shared.presentation.ui.theme.*

// Evalon Color Aliases
private val ChipSelectedBg = EvalonBlue
private val ChipUnselectedBg = EvalonSurfaceVariant
private val ChipSelectedText = Color.White
private val ChipUnselectedText = EvalonTextSecondary
private val SelectorBackground = EvalonDarkSurface

/**
 * Premium horizontal timeframe selector with animated chips.
 */
@Composable
fun TimeframeSelector(
    timeframes: List<Timeframe>,
    selectedTimeframe: Timeframe,
    onTimeframeSelected: (Timeframe) -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .fillMaxWidth()
            .background(SelectorBackground)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Row(
            modifier = Modifier
                .clip(RoundedCornerShape(12.dp))
                .background(ChipUnselectedBg)
                .padding(4.dp),
            horizontalArrangement = Arrangement.spacedBy(4.dp)
        ) {
            timeframes.forEach { timeframe ->
                PremiumTimeframeChip(
                    label = timeframe.displayLabel,
                    isSelected = timeframe == selectedTimeframe,
                    onClick = { onTimeframeSelected(timeframe) },
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

/**
 * Premium animated chip for timeframe selection.
 */
@Composable
private fun PremiumTimeframeChip(
    label: String,
    isSelected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val backgroundColor by animateColorAsState(
        targetValue = if (isSelected) ChipSelectedBg else Color.Transparent,
        animationSpec = tween(durationMillis = 200),
        label = "chipBgColor"
    )
    
    val textColor by animateColorAsState(
        targetValue = if (isSelected) ChipSelectedText else ChipUnselectedText,
        animationSpec = tween(durationMillis = 200),
        label = "chipTextColor"
    )
    
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(8.dp))
            .background(backgroundColor)
            .clickable(onClick = onClick)
            .padding(vertical = 10.dp),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.labelLarge,
            fontWeight = if (isSelected) FontWeight.Bold else FontWeight.Medium,
            color = textColor,
            letterSpacing = 0.5.sp
        )
    }
}

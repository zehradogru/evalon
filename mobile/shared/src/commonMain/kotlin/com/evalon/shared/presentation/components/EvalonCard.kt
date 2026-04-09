package com.evalon.shared.presentation.components

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.evalon.shared.presentation.ui.theme.EvalonSurfaceVariant

@Composable
fun EvalonCard(
    modifier: Modifier = Modifier,
    onClick: (() -> Unit)? = null,
    content: @Composable ColumnScope.() -> Unit
) {
    val shape = RoundedCornerShape(16.dp)
    if (onClick != null) {
        Card(
            onClick = onClick,
            modifier = modifier.clip(shape),
            shape = shape,
            colors = CardDefaults.cardColors(
                containerColor = Color(0xFF1A1A2E)
            ),
            border = BorderStroke(1.dp, EvalonSurfaceVariant.copy(alpha = 0.3f)),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                content = content
            )
        }
    } else {
        Card(
            modifier = modifier.clip(shape),
            shape = shape,
            colors = CardDefaults.cardColors(
                containerColor = Color(0xFF1A1A2E)
            ),
            border = BorderStroke(1.dp, EvalonSurfaceVariant.copy(alpha = 0.3f)),
            elevation = CardDefaults.cardElevation(defaultElevation = 0.dp)
        ) {
            Column(
                modifier = Modifier.padding(16.dp),
                content = content
            )
        }
    }
}

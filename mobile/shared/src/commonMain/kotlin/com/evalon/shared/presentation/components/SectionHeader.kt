package com.evalon.shared.presentation.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.presentation.ui.theme.EvalonBlue
import com.evalon.shared.presentation.ui.theme.EvalonTextPrimary

@Composable
fun SectionHeader(
    title: String,
    showAll: Boolean = false,
    onShowAllClick: (() -> Unit)? = null,
    modifier: Modifier = Modifier
) {
    Row(
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Text(
            text = title,
            color = EvalonTextPrimary,
            fontWeight = FontWeight.Bold,
            fontSize = 18.sp
        )

        if (showAll && onShowAllClick != null) {
            Text(
                text = "Tümünü Gör",
                color = EvalonBlue,
                fontSize = 14.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.clickable(onClick = onShowAllClick)
            )
        }
    }
}

package com.evalon.shared.presentation.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.presentation.ui.theme.*
import com.evalon.shared.util.format

data class StockItemData(
    val symbol: String,
    val companyName: String,
    val price: Double,
    val changePercent: Double,
    val volume: String = ""
)

@Composable
fun StockListItem(
    stock: StockItemData,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    val isPositive = stock.changePercent >= 0
    val changeColor = if (isPositive) EvalonGreen else EvalonRed
    val changePrefix = if (isPositive) "+" else ""

    Row(
        modifier = modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Symbol badge
        Box(
            modifier = Modifier
                .size(44.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(EvalonBlue.copy(alpha = 0.15f)),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = stock.symbol.take(2),
                color = EvalonBlue,
                fontWeight = FontWeight.Bold,
                fontSize = 14.sp
            )
        }

        Spacer(modifier = Modifier.width(12.dp))

        // Name column
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = stock.symbol,
                color = EvalonTextPrimary,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp
            )
            Text(
                text = stock.companyName,
                color = EvalonTextSecondary,
                fontSize = 12.sp,
                maxLines = 1
            )
        }

        Spacer(modifier = Modifier.width(8.dp))

        // Price column
        Column(horizontalAlignment = Alignment.End) {
            Text(
                text = "₺${stock.price.format(2)}",
                color = EvalonTextPrimary,
                fontWeight = FontWeight.SemiBold,
                fontSize = 15.sp
            )
            Text(
                text = "$changePrefix${stock.changePercent.format(2)}%",
                color = changeColor,
                fontWeight = FontWeight.Medium,
                fontSize = 13.sp
            )
        }
    }
}

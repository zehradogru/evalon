package com.evalon.shared.presentation.screens.stockdetail

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Remove
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.evalon.shared.presentation.ui.theme.*
import com.evalon.shared.util.format
import com.evalon.shared.util.formatTurkishCurrency

// Evalon Color Aliases
private val BuyGradientStart = EvalonGreen
private val BuyGradientEnd = EvalonGreenDark
private val SellGradientStart = EvalonRed
private val SellGradientEnd = EvalonRedDark
private val PriceUpColor = EvalonGreen
private val PriceDownColor = EvalonRed
private val DarkSurface = EvalonDarkSurface
private val DarkSurfaceVariant = EvalonSurfaceVariant
private val AccentColor = EvalonBlue
private val TextPrimary = EvalonTextPrimary
private val TextSecondary = EvalonTextSecondary

/**
 * Premium Trade Action Bar with glassmorphism effect.
 */
@Composable
fun TradeActionBar(
    currentPrice: Double?,
    totalAmount: Double?,
    priceChangePercent: Double?,
    isPriceUp: Boolean,
    quantity: Int,
    onIncreaseQuantity: () -> Unit,
    onDecreaseQuantity: () -> Unit,
    onBuyClicked: () -> Unit,
    onSellClicked: () -> Unit,
    modifier: Modifier = Modifier
) {
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = DarkSurface,
        shadowElevation = 16.dp
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp, vertical = 16.dp)
        ) {
            // Top Row: Price Info + Quantity
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.SpaceBetween
            ) {
                // Left: Price Column
                PriceSection(
                    currentPrice = currentPrice,
                    totalAmount = totalAmount,
                    priceChangePercent = priceChangePercent,
                    isPriceUp = isPriceUp
                )
                
                // Right: Quantity Selector
                PremiumQuantitySelector(
                    quantity = quantity,
                    onIncrease = onIncreaseQuantity,
                    onDecrease = onDecreaseQuantity
                )
            }
            
            Spacer(modifier = Modifier.height(16.dp))
            
            // Bottom Row: Buy/Sell Buttons
            Row(
                modifier = Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                // Buy Button
                PremiumTradeButton(
                    text = "AL",
                    gradientStart = BuyGradientStart,
                    gradientEnd = BuyGradientEnd,
                    onClick = onBuyClicked,
                    modifier = Modifier.weight(1f)
                )
                
                // Sell Button
                PremiumTradeButton(
                    text = "SAT",
                    gradientStart = SellGradientStart,
                    gradientEnd = SellGradientEnd,
                    onClick = onSellClicked,
                    modifier = Modifier.weight(1f)
                )
            }
        }
    }
}

/**
 * Price display section with unit and total.
 */
@Composable
private fun PriceSection(
    currentPrice: Double?,
    totalAmount: Double?,
    priceChangePercent: Double?,
    isPriceUp: Boolean
) {
    Column {
        // Unit Price Row
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(
                text = "Birim Fiyat",
                style = MaterialTheme.typography.labelSmall,
                color = TextSecondary,
                letterSpacing = 0.5.sp
            )
            
            if (priceChangePercent != null) {
                Spacer(modifier = Modifier.width(8.dp))
                PriceChangeBadge(
                    changePercent = priceChangePercent,
                    isPriceUp = isPriceUp
                )
            }
        }
        
        Spacer(modifier = Modifier.height(2.dp))
        
        // Unit Price Value
        Text(
            text = currentPrice?.let { formatCurrency(it) } ?: "—",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold,
            color = TextPrimary
        )
        
        Spacer(modifier = Modifier.height(8.dp))
        
        // Total Label
        Text(
            text = "Toplam Tutar",
            style = MaterialTheme.typography.labelSmall,
            color = TextSecondary,
            letterSpacing = 0.5.sp
        )
        
        Spacer(modifier = Modifier.height(2.dp))
        
        // Total Value (Highlighted)
        Text(
            text = totalAmount?.let { formatCurrency(it) } ?: "—",
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.Bold,
            color = AccentColor
        )
    }
}

/**
 * Animated price change badge.
 */
@Composable
private fun PriceChangeBadge(
    changePercent: Double,
    isPriceUp: Boolean
) {
    val backgroundColor = if (isPriceUp) {
        PriceUpColor.copy(alpha = 0.15f)
    } else {
        PriceDownColor.copy(alpha = 0.15f)
    }
    val textColor = if (isPriceUp) PriceUpColor else PriceDownColor
    val arrow = if (isPriceUp) "↑" else "↓"
    val sign = if (isPriceUp) "+" else ""
    
    Box(
        modifier = Modifier
            .clip(RoundedCornerShape(4.dp))
            .background(backgroundColor)
            .padding(horizontal = 6.dp, vertical = 2.dp)
    ) {
        Text(
            text = "$sign${changePercent.format(2)}% $arrow",
            style = MaterialTheme.typography.labelSmall,
            fontWeight = FontWeight.Bold,
            color = textColor,
            letterSpacing = 0.sp
        )
    }
}

/**
 * Premium quantity selector with modern styling.
 */
@Composable
private fun PremiumQuantitySelector(
    quantity: Int,
    onIncrease: () -> Unit,
    onDecrease: () -> Unit
) {
    Row(
        modifier = Modifier
            .clip(RoundedCornerShape(12.dp))
            .background(DarkSurfaceVariant)
            .padding(4.dp),
        verticalAlignment = Alignment.CenterVertically
    ) {
        // Decrease Button
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(DarkSurface)
                .clickable(onClick = onDecrease),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Remove,
                contentDescription = "Azalt",
                tint = TextSecondary,
                modifier = Modifier.size(20.dp)
            )
        }
        
        // Quantity Display
        Box(
            modifier = Modifier
                .padding(horizontal = 20.dp),
            contentAlignment = Alignment.Center
        ) {
            Text(
                text = quantity.toString(),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
                color = TextPrimary
            )
        }
        
        // Increase Button
        Box(
            modifier = Modifier
                .size(40.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(DarkSurface)
                .clickable(onClick = onIncrease),
            contentAlignment = Alignment.Center
        ) {
            Icon(
                imageVector = Icons.Default.Add,
                contentDescription = "Artır",
                tint = TextSecondary,
                modifier = Modifier.size(20.dp)
            )
        }
    }
}

/**
 * Premium gradient trade button.
 */
@Composable
private fun PremiumTradeButton(
    text: String,
    gradientStart: Color,
    gradientEnd: Color,
    onClick: () -> Unit,
    modifier: Modifier = Modifier
) {
    Box(
        modifier = modifier
            .height(52.dp)
            .clip(RoundedCornerShape(12.dp))
            .background(
                brush = Brush.horizontalGradient(
                    colors = listOf(gradientStart, gradientEnd)
                )
            )
            .clickable(onClick = onClick),
        contentAlignment = Alignment.Center
    ) {
        Text(
            text = text,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            color = Color.White,
            letterSpacing = 1.sp
        )
    }
}

/**
 * Formats currency with Turkish Lira symbol.
 */
private fun formatCurrency(amount: Double): String {
    return amount.formatTurkishCurrency()
}

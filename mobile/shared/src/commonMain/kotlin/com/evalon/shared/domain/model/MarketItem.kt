package com.evalon.shared.domain.model

data class MarketItem(
    val symbol: String,
    val name: String,
    val price: Double,
    val changePercent: Double,
    val volume: String = ""
)

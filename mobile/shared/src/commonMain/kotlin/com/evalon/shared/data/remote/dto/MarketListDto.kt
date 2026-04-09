package com.evalon.shared.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MarketListResponseDto(
    val warming: Boolean = false,
    val data: List<MarketItemDto> = emptyList()
)

@Serializable
data class MarketItemDto(
    val symbol: String = "",
    val name: String = "",
    val price: Double = 0.0,
    @SerialName("changePercent") val changePercent: Double = 0.0,
    val volume: String? = null
)

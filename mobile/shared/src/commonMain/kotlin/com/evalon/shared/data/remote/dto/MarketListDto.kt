package com.evalon.shared.data.remote.dto

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MarketListResponseDto(
    val warming: Boolean = false,
    val stale: Boolean = false,
    val items: List<MarketItemDto> = emptyList(),
    val data: List<MarketItemDto> = emptyList(),
    val total: Int = 0,
    val nextCursor: String? = null,
    val hasMore: Boolean = false,
    val snapshotAt: String? = null,
    val snapshotAgeMs: Long? = null,
    val meta: MarketDataMetaDto? = null
)

@Serializable
data class MarketItemDto(
    val ticker: String = "",
    val symbol: String = "",
    val name: String = "",
    val price: Double? = null,
    val changePct: Double? = null,
    @SerialName("changePercent") val changePercent: Double? = null,
    val changeVal: Double? = null,
    val high: Double? = null,
    val low: Double? = null,
    val vol: Double? = null,
    val rating: String = "Neutral",
    val marketCap: Double? = null,
    val pe: Double? = null,
    val eps: Double? = null,
    val sector: String? = null,
    val volume: String? = null
)

@Serializable
data class MarketOverviewResponseDto(
    val cards: List<MarketOverviewCardDto> = emptyList(),
    val meta: MarketDataMetaDto? = null
)

@Serializable
data class MarketOverviewCardDto(
    val id: String,
    val label: String,
    val value: Double? = null,
    val changePct: Double? = null,
    val currency: String,
    val source: String,
    val asOf: String,
    val stale: Boolean = false
)

@Serializable
data class MarketDataMetaDto(
    val stale: Boolean = false,
    val warming: Boolean = false,
    val partial: Boolean = false,
    val hasUsableData: Boolean = false,
    val source: String = "empty",
    val snapshotAgeMs: Long? = null,
    val message: String? = null,
    val emptyReason: String? = null,
    val failedTickers: List<String> = emptyList()
)

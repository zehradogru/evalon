package com.evalon.shared.data.mapper

import com.evalon.shared.data.remote.dto.CandleDto
import com.evalon.shared.data.remote.dto.PricesResponseDto
import com.evalon.shared.domain.model.StockCandle
import kotlinx.datetime.Instant

/**
 * Mapper for converting API DTOs to Domain models.
 */
object StockCandleMapper {
    
    /**
     * Converts a PricesResponseDto to a list of StockCandle domain objects.
     */
    fun mapToDomain(response: PricesResponseDto): List<StockCandle> {
        return response.data.map { dto -> mapCandleToDomain(dto) }
    }
    
    /**
     * Converts a single CandleDto to StockCandle.
     * Handles ISO datetime string to Unix timestamp conversion.
     */
    fun mapCandleToDomain(dto: CandleDto): StockCandle {
        val unixSeconds = parseIsoToUnixSeconds(dto.time)
        return StockCandle(
            time = unixSeconds,
            open = dto.open,
            high = dto.high,
            low = dto.low,
            close = dto.close,
            volume = dto.volume
        )
    }
    
    /**
     * Parses ISO datetime string to Unix timestamp in seconds.
     * Input format: "2026-01-21T10:00:00"
     */
    private fun parseIsoToUnixSeconds(isoDateTime: String): Long {
        return try {
            // Append 'Z' to indicate UTC if not present
            val normalized = if (isoDateTime.endsWith("Z")) isoDateTime else "${isoDateTime}Z"
            Instant.parse(normalized).epochSeconds
        } catch (e: Exception) {
            // Fallback: return 0 if parsing fails
            0L
        }
    }
}

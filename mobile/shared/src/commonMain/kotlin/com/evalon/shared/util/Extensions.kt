package com.evalon.shared.util

import kotlinx.datetime.Clock
import kotlin.math.abs
import kotlin.math.round

fun currentTimeMillis(): Long = Clock.System.now().toEpochMilliseconds()

/**
 * Sayıyı istenen ondalık basamağa yuvarlayıp String'e çevirir.
 * Saf Kotlin, platform bağımlılığı yok (grafik/para gösterimi için yeterli).
 *
 * Örnek: 125.567.format(2) -> "125.57"
 */
fun Double.format(digits: Int): String {
    val safeDigits = digits.coerceAtLeast(0)
    val factor = pow10(safeDigits)
    val scaled = round(abs(this) * factor).toLong()
    val isNegative = this < 0 && scaled != 0L
    val prefix = if (isNegative) "-" else ""
    val intPart = scaled / factor

    if (safeDigits == 0) return prefix + intPart.toString()

    val fracPart = scaled % factor
    val fracStr = fracPart.toString().padStart(safeDigits, '0')
    return "$prefix$intPart.$fracStr"
}

fun Double.formatGrouped(digits: Int): String {
    val safeDigits = digits.coerceAtLeast(0)
    val factor = pow10(safeDigits)
    val scaled = round(abs(this) * factor).toLong()
    val isNegative = this < 0 && scaled != 0L
    val prefix = if (isNegative) "-" else ""
    val intPart = scaled / factor
    val groupedIntPart = intPart
        .toString()
        .reversed()
        .chunked(3)
        .joinToString(",")
        .reversed()

    if (safeDigits == 0) return prefix + groupedIntPart

    val fracPart = scaled % factor
    val fracStr = fracPart.toString().padStart(safeDigits, '0')
    return "$prefix$groupedIntPart.$fracStr"
}

fun Double.formatTurkish(digits: Int): String {
    return formatGrouped(digits)
        .replace(",", "#")
        .replace(".", ",")
        .replace("#", ".")
}

fun Double.formatTurkishCurrency(digits: Int = 2, symbolAtStart: Boolean = false): String {
    val formatted = formatTurkish(digits)
    return if (symbolAtStart) {
        "₺$formatted"
    } else {
        "$formatted ₺"
    }
}

private fun pow10(digits: Int): Long {
    var factor = 1L
    repeat(digits) { factor *= 10L }
    return factor
}

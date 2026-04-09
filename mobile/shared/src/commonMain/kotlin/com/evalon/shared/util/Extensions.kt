package com.evalon.shared.util

/**
 * Sayıyı istenen ondalık basamağa yuvarlayıp String'e çevirir.
 * Saf Kotlin, platform bağımlılığı yok (grafik/para gösterimi için yeterli).
 *
 * Örnek: 125.567.format(2) -> "125.57"
 */
fun Double.format(digits: Int): String {
    if (digits <= 0) return kotlin.math.round(this).toString()
    var factor = 1.0
    repeat(digits) { factor *= 10.0 }
    val factorLong = factor.toLong()
    val scaled = kotlin.math.round(this * factor).toLong()
    val intPart = scaled / factorLong
    val fracPart = kotlin.math.abs(scaled % factorLong)
    val fracStr = fracPart.toString().padStart(digits, '0')
    return "$intPart.$fracStr"
}

package com.evalon.shared.domain.model

/**
 * Exchange category for filtering tickers.
 */
enum class ExchangeCategory(val displayName: String) {
    BIST("BIST")
}

/**
 * Stock market constants: supported exchanges and tickers.
 */
object StockConstants {

    /** Default ticker shown on app launch. */
    const val DEFAULT_TICKER = "THYAO"

    /** Default exchange on app launch. */
    val DEFAULT_EXCHANGE = ExchangeCategory.BIST

    // ─── BIST (Borsa Istanbul) ──────────────────────────────────────────

    val BIST_TICKERS = listOf(
        "AEFES", "AGHOL", "AHGAZ", "AGROT", "AKBNK", "AKCNS", "AKENR", "AKFGY", "AKSA", "AKSEN",
        "ALARK", "ALFAS", "ALGYO", "ALTNY", "ANSGR", "ARCLK", "ARDYZ", "ASELS", "ASTOR",
        "BAGFS", "BALSU", "BIMAS", "BIZIM", "BRSAN", "BRYAT", "BSOKE", "BTCIM",
        "CANTE", "CCOLA", "CIMSA", "CLEBI", "CWENE",
        "DAPGM", "DEVA", "DOAS", "DOHOL", "DSTKF",
        "ECILC", "EFOR", "EGEEN", "EKGYO", "ENERY", "ENJSA", "ENKAI", "EREGL", "EUPWR",
        "FENER", "FROTO",
        "GARAN", "GENIL", "GESAN", "GLRMK", "GRSEL", "GRTHO", "GSRAY", "GUBRF", "GWIND",
        "HALKB", "HEKTS",
        "ISCTR", "ISGYO", "ISMEN", "IZFAS", "IZENR",
        "KAREL", "KCAER", "KCHOL", "KLRHO", "KONTR", "KRDMD", "KTLEV", "KUYAS",
        "LOGO",
        "MAGEN", "MAVI", "MGROS", "MIATK", "MPARK",
        "NETAS",
        "OBAMS", "ODAS", "OTKAR", "OYAKC",
        "PASEU", "PATEK", "PETKM", "PETUN", "PGSUS", "PNSUT",
        "QUAGR",
        "RALYH", "REEDR",
        "SAHOL", "SASA", "SELEC", "SISE", "SKBNK", "SOKM",
        "TABGD", "TAVHL", "TCELL", "THYAO", "TKFEN", "TMSN", "TOASO", "TRALT", "TRENJ", "TRMET",
        "TSKB", "TSPOR", "TTKOM", "TTRAK", "TUKAS", "TUPRS", "TUREX", "TURSG",
        "ULKER",
        "VAKBN", "VESBE", "VESTL",
        "YEOTK", "YKBNK",
        "ZEDUR", "ZOREN"
    )

    // ─── Helper ─────────────────────────────────────────────────────────

    /**
     * Returns tickers for a given exchange category.
     */
    fun tickersForExchange(exchange: ExchangeCategory): List<String> = when (exchange) {
        ExchangeCategory.BIST -> BIST_TICKERS
    }

    /**
     * All tickers across all exchanges.
     */
    val SUPPORTED_TICKERS: List<String>
        get() = BIST_TICKERS
}

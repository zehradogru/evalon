package com.evalon.shared.domain.model

/**
 * Exchange category for filtering tickers.
 */
enum class ExchangeCategory(val displayName: String) {
    BIST("BIST"),
    NASDAQ("NASDAQ"),
    CRYPTO("Kripto"),
    FOREX("Döviz")
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

    // ─── NASDAQ / US Stocks ─────────────────────────────────────────────

    val NASDAQ_TICKERS = listOf(
        "AAPL", "MSFT", "GOOGL", "AMZN", "META", "NVDA", "TSLA", "NFLX",
        "AMD", "INTC", "PYPL", "ADBE", "CRM", "ORCL", "CSCO", "QCOM",
        "AVGO", "TXN", "SHOP", "SQ", "UBER", "ABNB", "COIN", "ROKU",
        "ZM", "SNAP", "PINS", "RBLX", "PLTR", "DKNG",
        "BA", "DIS", "KO", "PEP", "MCD", "WMT", "NKE", "SBUX",
        "JPM", "GS", "V", "MA", "BAC", "C",
        "XOM", "CVX", "PFE", "JNJ", "UNH", "ABBV"
    )

    // ─── Crypto ─────────────────────────────────────────────────────────

    val CRYPTO_TICKERS = listOf(
        "BTCUSDT", "ETHUSDT", "BNBUSDT", "SOLUSDT", "XRPUSDT",
        "ADAUSDT", "DOGEUSDT", "DOTUSDT", "AVAXUSDT", "MATICUSDT",
        "LINKUSDT", "UNIUSDT", "ATOMUSDT", "LTCUSDT", "ETCUSDT",
        "FILUSDT", "APTUSDT", "NEARUSDT", "ARBUSDT", "OPUSDT"
    )

    // ─── Forex / Döviz ──────────────────────────────────────────────────

    val FOREX_TICKERS = listOf(
        "USDTRY", "EURTRY", "GBPTRY", "JPYTRY", "CHFTRY",
        "EURUSD", "GBPUSD", "USDJPY", "USDCHF", "AUDUSD",
        "USOIL", "UKOIL", "XAUUSD", "XAGUSD", "NATGAS"
    )

    // ─── Helper ─────────────────────────────────────────────────────────

    /**
     * Returns tickers for a given exchange category.
     */
    fun tickersForExchange(exchange: ExchangeCategory): List<String> = when (exchange) {
        ExchangeCategory.BIST -> BIST_TICKERS
        ExchangeCategory.NASDAQ -> NASDAQ_TICKERS
        ExchangeCategory.CRYPTO -> CRYPTO_TICKERS
        ExchangeCategory.FOREX -> FOREX_TICKERS
    }

    /**
     * All tickers across all exchanges.
     */
    val SUPPORTED_TICKERS: List<String>
        get() = BIST_TICKERS + NASDAQ_TICKERS + CRYPTO_TICKERS + FOREX_TICKERS
}

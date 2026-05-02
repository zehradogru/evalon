package com.evalon.shared.data.remote

object ApiConfig {
    const val BASE_URL = "evalon-backtest-api-474112640179.europe-west1.run.app"
    
    // API Endpoints - Auth
    const val AUTH_LOGIN = "/auth/login"
    const val AUTH_REGISTER = "/auth/register"
    const val AUTH_REFRESH = "/auth/refresh"
    
    // API Endpoints - Strategies
    const val STRATEGIES = "/strategies"
    const val STRATEGY_BY_ID = "/strategies/{id}"
    const val STRATEGY_BACKTEST = "/strategies/{id}/backtest"
    
    // API Endpoints - Portfolio
    const val PORTFOLIO = "/portfolio"
    
    // API Endpoints - Market Data (Legacy)
    const val MARKET_DATA = "/market-data"
    const val MARKET_DATA_LATEST = "/market-data/{symbol}/latest"
    
    const val PRICES = "/v1/prices"
    const val PRICES_BATCH = "/v1/prices/batch"

    // API Endpoints - Markets
    const val MARKET_LIST = "/v1/markets/list"
    const val MARKET_OVERVIEW = "/v1/market-overview"

    // API Endpoints - Product parity
    const val INDICATORS_CATALOG = "/v1/indicators/catalog"
    const val INDICATORS = "/v1/indicators"
    const val NEWS = "/v1/news"
    const val SCREENER_TICKERS = "/v1/screener/tickers"
    const val SCREENER_SCAN = "/v1/screener/scan"
    const val BACKTEST_RULES = "/v1/backtests/catalog/rules"
    const val BACKTEST_PRESETS = "/v1/backtests/catalog/presets"
    const val BACKTEST_RUN = "/v1/backtests/run"
    const val BACKTEST_START = "/v1/backtests/start"
    const val BACKTEST_STATUS = "/v1/backtests/{runId}/status"
    const val BACKTEST_EVENTS = "/v1/backtests/{runId}/events"
    const val BACKTEST_PORTFOLIO_CURVE = "/v1/backtests/{runId}/portfolio-curve"
    const val AI_TOOLS = "/v1/ai/tools"
    const val AI_SESSIONS = "/v1/ai/sessions"
    const val AI_SESSION_BY_ID = "/v1/ai/sessions/{id}"
    const val AI_SESSION_MESSAGES = "/v1/ai/sessions/{id}/messages"
    const val AI_ASSETS = "/v1/ai/assets"
    const val AI_STRATEGIES = "/v1/ai/strategies"
    const val AI_RULES = "/v1/ai/rules"
    const val AI_INDICATORS = "/v1/ai/indicators"

    // API Endpoints - User
    const val USER_PROFILE = "/user/profile"
}

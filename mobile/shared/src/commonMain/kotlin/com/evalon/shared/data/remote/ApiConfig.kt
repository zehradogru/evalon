package com.evalon.shared.data.remote

object ApiConfig {
    // Backend API Base URL (can be changed for different environments)
    const val BASE_URL = "evalon-mu.vercel.app"
    
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
    
    // API Endpoints - Prices (New)
    const val PRICES = "/v1/prices"

    // API Endpoints - Markets
    const val MARKET_LIST = "/api/markets/list"

    // API Endpoints - User
    const val USER_PROFILE = "/user/profile"
}

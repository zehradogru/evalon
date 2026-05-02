package com.evalon.shared.di

import com.evalon.shared.data.local.DatabaseDriverFactory
import com.evalon.shared.data.local.DatabaseHelper
import com.evalon.shared.data.remote.createApiClient
import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.data.remote.api.*
import com.evalon.shared.data.repository.*
import com.evalon.shared.data.repository.TokenStorage
import org.koin.core.module.Module
import org.koin.dsl.module

val dataModule = module {
    includes(platformDataModule)

    // Session
    single { CurrentSession() }

    // Local database
    single { DatabaseHelper(get<DatabaseDriverFactory>()) }

    // HTTP Client — token-aware
    single { createApiClient(ApiConfig.BASE_URL, get<TokenStorage>()) }
    
    // API Services
    single { AuthApi(get()) }
    single { StrategyApi(get()) }
    single { BacktestApi(get()) }
    single { PortfolioApi(get()) }
    single { MarketDataApi(get()) }
    single { UserProfileApi(get()) }
    single { PricesApi(get()) }
    single { MarketsApi(get()) }
    single { ProductFeatureApi(get()) }
    
    // Repositories
    single<com.evalon.shared.domain.repository.AuthRepository> { 
        AuthRepositoryImpl(get(), get()) 
    }
    single<com.evalon.shared.domain.repository.StrategyRepository> { 
        StrategyRepositoryImpl(get()) 
    }
    single<com.evalon.shared.domain.repository.BacktestRepository> { 
        BacktestRepositoryImpl(get()) 
    }
    single<com.evalon.shared.domain.repository.PortfolioRepository> { 
        PortfolioRepositoryImpl(get()) 
    }
    single<com.evalon.shared.domain.repository.MarketDataRepository> { 
        MarketDataRepositoryImpl(get()) 
    }
    single<com.evalon.shared.domain.repository.UserProfileRepository> { 
        UserProfileRepositoryImpl(get()) 
    }
    single<com.evalon.shared.domain.repository.StockPriceRepository> {
        StockPriceRepositoryImpl(get(), get())
    }
    single<com.evalon.shared.domain.repository.MarketListRepository> {
        MarketListRepositoryImpl(get())
    }
}

expect val platformDataModule: Module

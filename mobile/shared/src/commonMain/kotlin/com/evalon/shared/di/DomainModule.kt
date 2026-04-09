package com.evalon.shared.di

import com.evalon.shared.domain.usecase.*
import org.koin.core.module.dsl.singleOf
import org.koin.dsl.module

val domainModule = module {
    singleOf(::CreateStrategyUseCase)
    singleOf(::GetStrategiesUseCase)
    singleOf(::RunBacktestUseCase)
    singleOf(::GetPortfolioUseCase)
    singleOf(::LoginUseCase)
    singleOf(::GetUserProfileUseCase)
}

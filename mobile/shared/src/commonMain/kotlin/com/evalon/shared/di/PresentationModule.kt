package com.evalon.shared.di

import com.evalon.shared.data.local.DatabaseHelper
import com.evalon.shared.presentation.screens.login.LoginViewModel
import com.evalon.shared.presentation.viewmodel.*
import org.koin.core.module.dsl.factoryOf
import org.koin.dsl.module

val presentationModule = module {
    factoryOf(::AuthViewModel)

    factory { LoginViewModel(get(), get()) }

    factory {
        val session = get<CurrentSession>()
        DashboardViewModel(
            getPortfolioUseCase = get(),
            getStrategiesUseCase = get(),
            dbHelper = get<DatabaseHelper>(),
            userId = session.userId
        )
    }
}

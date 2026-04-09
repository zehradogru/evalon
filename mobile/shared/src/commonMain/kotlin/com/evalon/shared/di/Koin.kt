package com.evalon.shared.di

import org.koin.core.context.startKoin
import org.koin.dsl.KoinAppDeclaration

private var koinInitialized = false

fun initKoin(appDeclaration: KoinAppDeclaration = {}) {
    if (!koinInitialized) {
        startKoin {
            appDeclaration()
            modules(
                appModule,
                dataModule,
                domainModule,
                presentationModule
            )
        }
        koinInitialized = true
    }
}

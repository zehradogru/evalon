package com.evalon.shared.di

import android.content.Context
import com.evalon.shared.data.local.DatabaseDriverFactory
import com.evalon.shared.data.repository.TokenStorage
import org.koin.core.module.Module
import org.koin.dsl.module

actual val platformDataModule: Module = module {
    single { TokenStorage(get<Context>()) }
    single { DatabaseDriverFactory(get<Context>()) }
}

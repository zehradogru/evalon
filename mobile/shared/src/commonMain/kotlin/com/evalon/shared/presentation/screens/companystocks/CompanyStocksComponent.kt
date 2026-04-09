package com.evalon.shared.presentation.screens.companystocks

import com.arkivanov.decompose.ComponentContext

interface CompanyStocksComponent {
    val companyId: String?
    fun navigateBack()
}

class CompanyStocksComponentImpl(
    componentContext: ComponentContext,
    override val companyId: String? = null
) : ComponentContext by componentContext, CompanyStocksComponent {
    override fun navigateBack() {}
}

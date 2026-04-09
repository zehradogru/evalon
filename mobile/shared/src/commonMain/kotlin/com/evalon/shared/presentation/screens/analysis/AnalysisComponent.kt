package com.evalon.shared.presentation.screens.analysis

import com.arkivanov.decompose.ComponentContext

interface AnalysisComponent {
    fun navigateBack()
}

class AnalysisComponentImpl(
    componentContext: ComponentContext
) : ComponentContext by componentContext, AnalysisComponent {
    override fun navigateBack() {}
}

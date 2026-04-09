package com.evalon.shared.presentation.screens.llm

import com.arkivanov.decompose.ComponentContext

interface LLMComponent {
    fun navigateBack()
}

class LLMComponentImpl(
    componentContext: ComponentContext
) : ComponentContext by componentContext, LLMComponent {
    override fun navigateBack() {}
}

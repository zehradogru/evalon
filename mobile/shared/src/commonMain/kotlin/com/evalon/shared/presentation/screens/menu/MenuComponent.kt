package com.evalon.shared.presentation.screens.menu

import com.arkivanov.decompose.ComponentContext

interface MenuComponent

class MenuComponentImpl(
    componentContext: ComponentContext
) : MenuComponent, ComponentContext by componentContext

package com.evalon.shared.presentation.screens.settings

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class SettingsUiState(
    val notificationsEnabled: Boolean = true,
    val darkMode: Boolean = true,
    val language: String = "Türkçe",
    val defaultExchange: String = "BIST",
    val biometricEnabled: Boolean = false,
    val appVersion: String = "1.0.0"
)

class SettingsViewModel {
    private val _uiState = MutableStateFlow(SettingsUiState())
    val uiState: StateFlow<SettingsUiState> = _uiState.asStateFlow()

    fun toggleNotifications() {
        _uiState.value = _uiState.value.copy(
            notificationsEnabled = !_uiState.value.notificationsEnabled
        )
    }

    fun toggleBiometric() {
        _uiState.value = _uiState.value.copy(
            biometricEnabled = !_uiState.value.biometricEnabled
        )
    }

    fun setDefaultExchange(exchange: String) {
        _uiState.value = _uiState.value.copy(defaultExchange = exchange)
    }
}

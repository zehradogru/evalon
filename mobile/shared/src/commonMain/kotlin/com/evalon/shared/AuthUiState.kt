package com.evalon.shared

data class AuthUiState(
    val isLoading: Boolean = false,
    val isSignedIn: Boolean = false,
    val uid: String? = null,
    val idToken: String? = null,
    val displayName: String? = null,
    val email: String? = null,
    val errorMessage: String? = null,
    val infoMessage: String? = null
)

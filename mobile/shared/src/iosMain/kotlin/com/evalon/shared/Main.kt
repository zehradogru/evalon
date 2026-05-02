package com.evalon.shared

import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.window.ComposeUIViewController
import platform.UIKit.UIViewController

fun MainViewController(): UIViewController = ComposeUIViewController { App() }

class IosAppBridge {
    private var authUiState by mutableStateOf(AuthUiState())
    private var onEmailSignInRequested: (String, String) -> Unit = { _, _ -> }
    private var onEmailSignUpRequested: (String, String) -> Unit = { _, _ -> }
    private var onPasswordResetRequested: (String) -> Unit = {}
    private var onGoogleSignInRequested: () -> Unit = {}
    private var onAppleSignInRequested: () -> Unit = {}
    private var onAvatarPickRequested: () -> Unit = {}
    private var onSignOutRequested: () -> Unit = {}

    fun setOnEmailSignInRequested(handler: (String, String) -> Unit) {
        onEmailSignInRequested = handler
    }

    fun setOnEmailSignUpRequested(handler: (String, String) -> Unit) {
        onEmailSignUpRequested = handler
    }

    fun setOnPasswordResetRequested(handler: (String) -> Unit) {
        onPasswordResetRequested = handler
    }

    fun setOnGoogleSignInRequested(handler: () -> Unit) {
        onGoogleSignInRequested = handler
    }

    fun setOnAppleSignInRequested(handler: () -> Unit) {
        onAppleSignInRequested = handler
    }

    fun setOnAvatarPickRequested(handler: () -> Unit) {
        onAvatarPickRequested = handler
    }

    fun setOnSignOutRequested(handler: () -> Unit) {
        onSignOutRequested = handler
    }

    fun updateAuthState(
        displayName: String?,
        email: String?,
        isLoading: Boolean,
        errorMessage: String?
    ) {
        setAuthState(
            displayName = displayName,
            email = email,
            isLoading = isLoading,
            errorMessage = errorMessage,
            infoMessage = null
        )
    }

    fun updateAuthInfoState(
        displayName: String?,
        email: String?,
        isLoading: Boolean,
        errorMessage: String?,
        infoMessage: String?
    ) {
        setAuthState(
            displayName = displayName,
            email = email,
            isLoading = isLoading,
            errorMessage = errorMessage,
            infoMessage = infoMessage
        )
    }

    private fun setAuthState(
        displayName: String?,
        email: String?,
        isLoading: Boolean,
        errorMessage: String?,
        infoMessage: String?
    ) {
        val signedIn = !displayName.isNullOrBlank() || !email.isNullOrBlank()
        authUiState = AuthUiState(
            isLoading = isLoading,
            isSignedIn = signedIn,
            uid = if (signedIn) authUiState.uid else null,
            idToken = if (signedIn) authUiState.idToken else null,
            displayName = displayName,
            email = email,
            errorMessage = errorMessage,
            infoMessage = infoMessage
        )
    }

    fun updateAuthStateWithToken(
        uid: String?,
        idToken: String?,
        displayName: String?,
        email: String?,
        isLoading: Boolean,
        errorMessage: String?
    ) {
        setAuthTokenState(
            uid = uid,
            idToken = idToken,
            displayName = displayName,
            email = email,
            isLoading = isLoading,
            errorMessage = errorMessage,
            infoMessage = null
        )
    }

    fun updateAuthStateWithTokenInfo(
        uid: String?,
        idToken: String?,
        displayName: String?,
        email: String?,
        isLoading: Boolean,
        errorMessage: String?,
        infoMessage: String?
    ) {
        setAuthTokenState(
            uid = uid,
            idToken = idToken,
            displayName = displayName,
            email = email,
            isLoading = isLoading,
            errorMessage = errorMessage,
            infoMessage = infoMessage
        )
    }

    private fun setAuthTokenState(
        uid: String?,
        idToken: String?,
        displayName: String?,
        email: String?,
        isLoading: Boolean,
        errorMessage: String?,
        infoMessage: String?
    ) {
        authUiState = AuthUiState(
            isLoading = isLoading,
            isSignedIn = !uid.isNullOrBlank() || !displayName.isNullOrBlank() || !email.isNullOrBlank(),
            uid = uid,
            idToken = idToken,
            displayName = displayName,
            email = email,
            errorMessage = errorMessage,
            infoMessage = infoMessage
        )
    }

    fun makeRootViewController(): UIViewController = ComposeUIViewController {
        App(
            authUiState = authUiState,
            onEmailSignInClick = onEmailSignInRequested,
            onEmailSignUpClick = onEmailSignUpRequested,
            onPasswordResetClick = onPasswordResetRequested,
            onGoogleSignInClick = onGoogleSignInRequested,
            onAppleSignInClick = onAppleSignInRequested,
            supportsAppleSignIn = true,
            onPickAvatarClick = onAvatarPickRequested,
            onSignOutClick = onSignOutRequested
        )
    }
}

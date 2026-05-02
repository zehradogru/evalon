package com.evalon.android

import android.os.Bundle
import android.util.Log
import androidx.activity.result.ActivityResultLauncher
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.credentials.ClearCredentialStateRequest
import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.ClearCredentialException
import androidx.credentials.exceptions.GetCredentialException
import androidx.lifecycle.lifecycleScope
import com.evalon.shared.App
import com.evalon.shared.AuthUiState
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import com.google.firebase.FirebaseApp
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.GoogleAuthProvider
import com.google.firebase.auth.UserProfileChangeRequest
import com.google.firebase.storage.FirebaseStorage
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    private lateinit var auth: FirebaseAuth
    private lateinit var credentialManager: CredentialManager
    private lateinit var avatarPicker: ActivityResultLauncher<String>
    private var authUiState by mutableStateOf(AuthUiState())

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        FirebaseApp.initializeApp(this)
        auth = FirebaseAuth.getInstance()
        credentialManager = CredentialManager.create(this)
        avatarPicker = registerForActivityResult(ActivityResultContracts.GetContent()) { uri ->
            if (uri != null) {
                uploadAvatar(uri)
            }
        }
        refreshAuthState()

        setContent {
            App(
                authUiState = authUiState,
                onEmailSignInClick = ::signInWithEmail,
                onEmailSignUpClick = ::signUpWithEmail,
                onPasswordResetClick = ::sendPasswordReset,
                onGoogleSignInClick = ::startGoogleSignIn,
                onPickAvatarClick = ::pickAvatar,
                onSignOutClick = ::signOut
            )
        }
    }

    override fun onStart() {
        super.onStart()
        refreshAuthState()
    }

    private fun startGoogleSignIn() {
        authUiState = authUiState.copy(isLoading = true, errorMessage = null, infoMessage = null)

        lifecycleScope.launch {
            try {
                val googleIdOption = GetGoogleIdOption.Builder()
                    .setServerClientId(getString(R.string.default_web_client_id))
                    .setFilterByAuthorizedAccounts(false)
                    .setAutoSelectEnabled(false)
                    .build()

                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build()

                val result = credentialManager.getCredential(
                    context = this@MainActivity,
                    request = request
                )

                val credential = result.credential
                if (
                    credential is CustomCredential &&
                    credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    val googleIdTokenCredential = GoogleIdTokenCredential.createFrom(credential.data)
                    signInWithFirebase(googleIdTokenCredential.idToken)
                } else {
                    authUiState = authUiState.copy(
                        isLoading = false,
                        errorMessage = "Google kimligi alinamadi."
                    )
                }
            } catch (error: GetCredentialException) {
                Log.w(TAG, "Google sign-in failed", error)
                authUiState = authUiState.copy(
                    isLoading = false,
                    errorMessage = googleAuthErrorMessage(error.localizedMessage)
                )
            } catch (error: GoogleIdTokenParsingException) {
                Log.w(TAG, "Google ID token parsing failed", error)
                authUiState = authUiState.copy(
                    isLoading = false,
                    errorMessage = "Google kimlik verisi okunamadi."
                )
            }
        }
    }

    private fun signInWithFirebase(idToken: String) {
        val credential = GoogleAuthProvider.getCredential(idToken, null)
        auth.signInWithCredential(credential)
            .addOnCompleteListener(this) { task ->
                if (task.isSuccessful) {
                    refreshAuthState(infoMessage = "Google ile giris tamamlandi.")
                } else {
                    Log.w(TAG, "Firebase Google sign-in failed", task.exception)
                    authUiState = authUiState.copy(
                        isLoading = false,
                        errorMessage = googleAuthErrorMessage(task.exception?.localizedMessage)
                    )
                }
            }
    }

    private fun googleAuthErrorMessage(detail: String?): String {
        val suffix = detail?.takeIf { it.isNotBlank() }?.let { " Detay: $it" }.orEmpty()
        return "Google girisi tamamlanamadi. Firebase Console'da com.evalon.android icin SHA-1/SHA-256 ve Android OAuth client tanimli olmali.$suffix"
    }

    private fun signInWithEmail(email: String, password: String) {
        val cleanEmail = email.trim()
        if (cleanEmail.isBlank() || password.isBlank()) {
            authUiState = authUiState.copy(errorMessage = "Email ve sifre gerekli.", infoMessage = null)
            return
        }

        authUiState = authUiState.copy(isLoading = true, errorMessage = null, infoMessage = null)
        auth.signInWithEmailAndPassword(cleanEmail, password)
            .addOnCompleteListener(this) { task ->
                if (task.isSuccessful) {
                    refreshAuthState(infoMessage = "Web hesabinla ayni Firebase oturumu acildi.")
                } else {
                    Log.w(TAG, "Email sign-in failed", task.exception)
                    authUiState = authUiState.copy(
                        isLoading = false,
                        errorMessage = task.exception?.localizedMessage ?: "Email girisi basarisiz.",
                        infoMessage = null
                    )
                }
            }
    }

    private fun signUpWithEmail(email: String, password: String) {
        val cleanEmail = email.trim()
        if (cleanEmail.isBlank() || password.isBlank()) {
            authUiState = authUiState.copy(errorMessage = "Email ve sifre gerekli.", infoMessage = null)
            return
        }
        if (password.length < 6) {
            authUiState = authUiState.copy(errorMessage = "Sifre en az 6 karakter olmali.", infoMessage = null)
            return
        }

        authUiState = authUiState.copy(isLoading = true, errorMessage = null, infoMessage = null)
        auth.createUserWithEmailAndPassword(cleanEmail, password)
            .addOnCompleteListener(this) { task ->
                if (task.isSuccessful) {
                    task.result.user?.sendEmailVerification()
                    refreshAuthState(infoMessage = "Hesap olusturuldu. Dogrulama emaili gonderildi.")
                } else {
                    Log.w(TAG, "Email sign-up failed", task.exception)
                    authUiState = authUiState.copy(
                        isLoading = false,
                        errorMessage = task.exception?.localizedMessage ?: "Hesap olusturulamadi.",
                        infoMessage = null
                    )
                }
            }
    }

    private fun sendPasswordReset(email: String) {
        val cleanEmail = email.trim()
        if (cleanEmail.isBlank()) {
            authUiState = authUiState.copy(errorMessage = "Sifre sifirlama icin email gir.", infoMessage = null)
            return
        }

        authUiState = authUiState.copy(isLoading = true, errorMessage = null, infoMessage = null)
        auth.sendPasswordResetEmail(cleanEmail)
            .addOnCompleteListener(this) { task ->
                authUiState = if (task.isSuccessful) {
                    authUiState.copy(
                        isLoading = false,
                        errorMessage = null,
                        infoMessage = "Sifre sifirlama emaili gonderildi."
                    )
                } else {
                    Log.w(TAG, "Password reset failed", task.exception)
                    authUiState.copy(
                        isLoading = false,
                        errorMessage = task.exception?.localizedMessage ?: "Sifre sifirlama emaili gonderilemedi.",
                        infoMessage = null
                    )
                }
            }
    }

    private fun signOut() {
        auth.signOut()
        authUiState = AuthUiState()

        lifecycleScope.launch {
            try {
                credentialManager.clearCredentialState(ClearCredentialStateRequest())
            } catch (error: ClearCredentialException) {
                Log.w(TAG, "Credential state clear failed", error)
            }
        }
    }

    private fun pickAvatar() {
        if (auth.currentUser == null) {
            authUiState = authUiState.copy(errorMessage = "Avatar yuklemek icin giris yapmalisin.", infoMessage = null)
            return
        }
        avatarPicker.launch("image/*")
    }

    private fun uploadAvatar(uri: android.net.Uri) {
        val user = auth.currentUser ?: return
        authUiState = authUiState.copy(isLoading = true, errorMessage = null, infoMessage = null)
        val ref = FirebaseStorage.getInstance()
            .reference
            .child("users/${user.uid}/avatar.jpg")

        ref.putFile(uri)
            .continueWithTask { task ->
                if (!task.isSuccessful) {
                    task.exception?.let { throw it }
                }
                ref.downloadUrl
            }
            .addOnSuccessListener { downloadUrl ->
                val request = UserProfileChangeRequest.Builder()
                    .setPhotoUri(downloadUrl)
                    .build()
                user.updateProfile(request).addOnCompleteListener {
                    if (it.isSuccessful) {
                        refreshAuthState(infoMessage = "Avatar Firebase Storage'a yuklendi.")
                    } else {
                        authUiState = authUiState.copy(
                            isLoading = false,
                            errorMessage = it.exception?.localizedMessage,
                            infoMessage = null
                        )
                    }
                }
            }
            .addOnFailureListener { error ->
                authUiState = authUiState.copy(
                    isLoading = false,
                    errorMessage = error.localizedMessage ?: "Avatar yuklenemedi.",
                    infoMessage = null
                )
            }
    }

    private fun refreshAuthState(infoMessage: String? = null) {
        val user = auth.currentUser
        authUiState = AuthUiState(
            isLoading = false,
            isSignedIn = user != null,
            uid = user?.uid,
            displayName = user?.displayName,
            email = user?.email,
            errorMessage = null,
            infoMessage = infoMessage
        )
        user?.getIdToken(false)?.addOnSuccessListener { result ->
            authUiState = authUiState.copy(idToken = result.token)
        }?.addOnFailureListener { error ->
            Log.w(TAG, "Firebase ID token fetch failed", error)
            authUiState = authUiState.copy(
                errorMessage = error.localizedMessage ?: "Firebase oturum tokeni alinamadi.",
                infoMessage = null
            )
        }
    }

    private companion object {
        const val TAG = "EvalonMainActivity"
    }
}

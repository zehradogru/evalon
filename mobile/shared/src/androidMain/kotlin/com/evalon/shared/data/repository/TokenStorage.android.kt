package com.evalon.shared.data.repository

import android.content.Context
import android.content.SharedPreferences

actual class TokenStorage(context: Context) {
    private val prefs: SharedPreferences = context.getSharedPreferences("evalon_prefs", Context.MODE_PRIVATE)
    private val tokenKey = "auth_token"
    private val refreshTokenKey = "refresh_token"

    actual fun getToken(): String? = prefs.getString(tokenKey, null)

    actual fun saveToken(token: String) {
        prefs.edit().putString(tokenKey, token).apply()
    }

    actual fun getRefreshToken(): String? = prefs.getString(refreshTokenKey, null)

    actual fun saveRefreshToken(token: String) {
        prefs.edit().putString(refreshTokenKey, token).apply()
    }

    actual fun clearToken() {
        prefs.edit().remove(tokenKey).remove(refreshTokenKey).apply()
    }
}

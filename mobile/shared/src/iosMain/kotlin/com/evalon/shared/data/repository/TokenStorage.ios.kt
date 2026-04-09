package com.evalon.shared.data.repository

import platform.Foundation.NSUserDefaults

actual class TokenStorage {
    private val defaults = NSUserDefaults.standardUserDefaults
    private val tokenKey = "auth_token"
    private val refreshTokenKey = "refresh_token"

    actual fun getToken(): String? = defaults.stringForKey(tokenKey)

    actual fun saveToken(token: String) {
        defaults.setObject(token, forKey = tokenKey)
    }

    actual fun getRefreshToken(): String? = defaults.stringForKey(refreshTokenKey)

    actual fun saveRefreshToken(token: String) {
        defaults.setObject(token, forKey = refreshTokenKey)
    }

    actual fun clearToken() {
        defaults.removeObjectForKey(tokenKey)
        defaults.removeObjectForKey(refreshTokenKey)
    }
}

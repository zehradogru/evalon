package com.evalon.shared.di

/**
 * Runtime session holder. Updated after successful login.
 * Injected as a singleton so DashboardViewModel and others always read the live userId.
 */
class CurrentSession {
    var userId: String = ""
    var isLoggedIn: Boolean = false
}

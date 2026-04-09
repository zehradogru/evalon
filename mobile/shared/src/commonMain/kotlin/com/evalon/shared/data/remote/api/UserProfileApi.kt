package com.evalon.shared.data.remote.api

import com.evalon.shared.data.remote.ApiConfig
import com.evalon.shared.domain.model.UserProfile
import io.ktor.client.HttpClient
import io.ktor.client.call.body
import io.ktor.client.request.get
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.request.url

class UserProfileApi(private val client: HttpClient) {
    suspend fun getUserProfile(userId: String): UserProfile {
        return client.get(ApiConfig.USER_PROFILE) {
            url {
                parameters.append("userId", userId)
            }
        }.body()
    }

    suspend fun updateUserProfile(profile: UserProfile): UserProfile {
        return client.put(ApiConfig.USER_PROFILE) {
            setBody(profile)
        }.body()
    }
}

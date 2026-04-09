package com.evalon.shared.domain.repository

import com.evalon.shared.domain.model.UserProfile
import kotlinx.coroutines.flow.Flow

interface UserProfileRepository {
    suspend fun getUserProfile(userId: String): Result<UserProfile>
    suspend fun updateUserProfile(profile: UserProfile): Result<UserProfile>
    fun observeUserProfile(userId: String): Flow<UserProfile>
}

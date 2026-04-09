package com.evalon.shared.data.repository

import com.evalon.shared.data.remote.api.UserProfileApi
import com.evalon.shared.domain.model.UserProfile
import com.evalon.shared.domain.repository.UserProfileRepository
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.flow

class UserProfileRepositoryImpl(
    private val userProfileApi: UserProfileApi
) : UserProfileRepository {

    override suspend fun getUserProfile(userId: String): Result<UserProfile> {
        return try {
            Result.success(userProfileApi.getUserProfile(userId))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun updateUserProfile(profile: UserProfile): Result<UserProfile> {
        return try {
            Result.success(userProfileApi.updateUserProfile(profile))
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override fun observeUserProfile(userId: String): Flow<UserProfile> = flow {
        try {
            val profile = userProfileApi.getUserProfile(userId)
            emit(profile)
        } catch (e: Exception) {
            // TODO: Handle error properly
            throw e
        }
    }
}

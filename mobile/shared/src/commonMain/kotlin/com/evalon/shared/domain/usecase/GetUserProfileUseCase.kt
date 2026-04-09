package com.evalon.shared.domain.usecase

import com.evalon.shared.domain.model.UserProfile
import com.evalon.shared.domain.repository.UserProfileRepository
import kotlinx.coroutines.flow.Flow

class GetUserProfileUseCase(
    private val userProfileRepository: UserProfileRepository
) {
    operator fun invoke(userId: String): Flow<UserProfile> {
        return userProfileRepository.observeUserProfile(userId)
    }
}

'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/store/use-auth-store'
import {
    profileService,
    UpdatePreferencesPayload,
    UpdateProfilePayload,
} from '@/services/profile.service'
import type { UserProfile } from '@/types'
import { resolveAvatarUrl } from '@/lib/avatar'

const PROFILE_QUERY_KEY = 'user-profile'

export function useProfile() {
    const { user, isAuthenticated } = useAuthStore()

    return useQuery({
        queryKey: [PROFILE_QUERY_KEY, user?.id],
        queryFn: () => profileService.getOrCreateProfile(),
        enabled: isAuthenticated && Boolean(user?.id),
        staleTime: 1000 * 60 * 5,
    })
}

function useProfileCacheSync() {
    const queryClient = useQueryClient()
    const updateUser = useAuthStore((state) => state.updateUser)

    const syncProfile = (profile: UserProfile) => {
        queryClient.setQueryData([PROFILE_QUERY_KEY, profile.uid], profile)
        updateUser({
            email: profile.email,
            name: profile.displayName || undefined,
            photoURL: resolveAvatarUrl({
                photoURL: profile.photoURL,
                name: profile.displayName,
                email: profile.email,
            }),
            authSecurity: profile.authSecurity,
        })
    }

    return { syncProfile }
}

export function useUpdateProfile() {
    const { syncProfile } = useProfileCacheSync()

    return useMutation({
        mutationFn: (payload: UpdateProfilePayload) =>
            profileService.updateProfile(payload),
        onSuccess: (profile) => {
            syncProfile(profile)
        },
    })
}

export function useUpdatePreferences() {
    const { syncProfile } = useProfileCacheSync()

    return useMutation({
        mutationFn: (payload: UpdatePreferencesPayload) =>
            profileService.updatePreferences(payload),
        onSuccess: (profile) => {
            syncProfile(profile)
        },
    })
}

export function useUploadProfilePhoto() {
    const { syncProfile } = useProfileCacheSync()

    return useMutation({
        mutationFn: (file: File) => profileService.uploadProfilePhoto(file),
        onSuccess: (profile) => {
            syncProfile(profile)
        },
    })
}

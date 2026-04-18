import { create } from 'zustand'
import { User } from '@/types'
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { resolveAvatarUrl } from '@/lib/avatar'
import {
    mapFirebaseUserToAppUser,
    shouldRequireEmailVerification,
} from '@/lib/auth-utils'
import { profileService } from '@/services/profile.service'

interface AuthState {
    user: User | null
    isAuthenticated: boolean
    requiresEmailVerification: boolean
    loading: boolean
    initialized: boolean
    login: (user: User) => void
    logout: () => void
    updateUser: (updates: Partial<User>) => void
    setLoading: (loading: boolean) => void
    initializeAuth: () => void
}

function withDefaultAvatar(user: User): User {
    return {
        ...user,
        photoURL: resolveAvatarUrl({
            photoURL: user.photoURL,
            name: user.name,
            email: user.email,
        }),
    }
}

async function hydrateAuthenticatedUser(
    firebaseUser: FirebaseUser | null,
    set: (partial: Partial<AuthState>) => void
): Promise<void> {
    if (!firebaseUser) {
        set({
            user: null,
            isAuthenticated: false,
            requiresEmailVerification: false,
            loading: false,
        })
        return
    }

    try {
        const authSecurity = await profileService.getAuthSecurityByUserId(
            firebaseUser.uid
        )
        const user = withDefaultAvatar(
            mapFirebaseUserToAppUser(firebaseUser, authSecurity)
        )

        set({
            user,
            isAuthenticated: true,
            requiresEmailVerification: shouldRequireEmailVerification(user),
            loading: false,
        })
    } catch {
        const user = withDefaultAvatar(mapFirebaseUserToAppUser(firebaseUser))

        set({
            user,
            isAuthenticated: true,
            requiresEmailVerification: false,
            loading: false,
        })
    }
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    requiresEmailVerification: false,
    loading: true,
    initialized: false,
    login: (user) => {
        const nextUser = withDefaultAvatar(user)

        set({
            user: nextUser,
            isAuthenticated: true,
            requiresEmailVerification: shouldRequireEmailVerification(nextUser),
            loading: false,
        })
    },
    logout: () =>
        set({
            user: null,
            isAuthenticated: false,
            requiresEmailVerification: false,
            loading: false,
        }),
    updateUser: (updates) =>
        set((state) => {
            const nextUser = state.user
                ? withDefaultAvatar({ ...state.user, ...updates })
                : state.user

            return {
                user: nextUser,
                requiresEmailVerification: shouldRequireEmailVerification(nextUser),
            }
        }),
    setLoading: (loading) => set({ loading }),
    initializeAuth: () => {
        if (useAuthStore.getState().initialized) return

        set({ initialized: true, loading: true })

        onAuthStateChanged(auth, (firebaseUser) => {
            set({ loading: true })
            void hydrateAuthenticatedUser(firebaseUser, set)
        })
    },
}))

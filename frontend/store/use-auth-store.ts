import { create } from 'zustand'
import { User } from '@/types'
import { onAuthStateChanged } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { resolveAvatarUrl } from '@/lib/avatar'

interface AuthState {
    user: User | null
    isAuthenticated: boolean
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

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    isAuthenticated: false,
    loading: true,
    initialized: false,
    login: (user) => set({ user: withDefaultAvatar(user), isAuthenticated: true }),
    logout: () => set({ user: null, isAuthenticated: false }),
    updateUser: (updates) =>
        set((state) => ({
            user: state.user ? withDefaultAvatar({ ...state.user, ...updates }) : state.user,
        })),
    setLoading: (loading) => set({ loading }),
    initializeAuth: () => {
        // Prevent multiple initializations
        if (useAuthStore.getState().initialized) return

        set({ initialized: true })

        // Listen to Firebase auth state changes
        onAuthStateChanged(auth, (firebaseUser) => {
            if (firebaseUser) {
                const user: User = {
                    id: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    name: firebaseUser.displayName || undefined,
                    photoURL: resolveAvatarUrl({
                        photoURL: firebaseUser.photoURL,
                        name: firebaseUser.displayName,
                        email: firebaseUser.email,
                    }),
                    createdAt:
                        firebaseUser.metadata.creationTime || new Date().toISOString(),
                }
                set({ user, isAuthenticated: true, loading: false })
            } else {
                set({ user: null, isAuthenticated: false, loading: false })
            }
        })
    },
}))

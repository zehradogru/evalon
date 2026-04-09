import { User } from '@/types'
import type { FirebaseError } from 'firebase/app'
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    signInWithPopup,
    updateProfile,
    User as FirebaseUser,
} from 'firebase/auth'
import { auth, googleProvider, appleProvider } from '@/lib/firebase'

interface LoginCredentials {
    email: string
    password: string
}

interface SignupData {
    email: string
    password: string
    name: string
}

interface AuthResponse {
    user: User
}

function isFirebaseError(error: unknown): error is FirebaseError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as { code?: unknown }).code === 'string'
    )
}

// Convert Firebase User to App User
const mapFirebaseUserToAppUser = (firebaseUser: FirebaseUser): User => {
    return {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || undefined,
        photoURL: firebaseUser.photoURL || undefined,
        createdAt: firebaseUser.metadata.creationTime || new Date().toISOString(),
    }
}

// Firebase error messages to user-friendly messages
const getErrorMessage = (error: unknown): string => {
    const errorCode = isFirebaseError(error) ? error.code : undefined
    switch (errorCode) {
        case 'auth/email-already-in-use':
            return 'Email already exists'
        case 'auth/invalid-email':
            return 'Invalid email address'
        case 'auth/user-not-found':
            return 'Invalid email or password'
        case 'auth/wrong-password':
            return 'Invalid email or password'
        case 'auth/weak-password':
            return 'Password must be at least 6 characters'
        case 'auth/too-many-requests':
            return 'Too many attempts. Please try again later'
        case 'auth/popup-closed-by-user':
            return 'Sign-in popup was closed'
        case 'auth/cancelled-popup-request':
            return 'Sign-in cancelled'
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection'
        default:
            return error instanceof Error ? error.message : 'An error occurred'
    }
}


export const authService = {
    /**
     * Login with email and password
     */
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        try {
            const userCredential = await signInWithEmailAndPassword(
                auth,
                credentials.email,
                credentials.password
            )
            return { user: mapFirebaseUserToAppUser(userCredential.user) }
        } catch (error: unknown) {
            throw new Error(getErrorMessage(error))
        }
    },

    /**
     * Signup with email, password, and name
     */
    async signup(data: SignupData): Promise<AuthResponse> {
        try {
            // Create user account
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                data.email,
                data.password
            )

            // Update profile with name
            await updateProfile(userCredential.user, {
                displayName: data.name,
            })

            // Return updated user
            return {
                user: {
                    ...mapFirebaseUserToAppUser(userCredential.user),
                    name: data.name,
                },
            }
        } catch (error: unknown) {
            throw new Error(getErrorMessage(error))
        }
    },

    /**
     * Login with Google
     */
    async loginWithGoogle(): Promise<AuthResponse> {
        try {
            const result = await signInWithPopup(auth, googleProvider)
            return { user: mapFirebaseUserToAppUser(result.user) }
        } catch (error: unknown) {
            throw new Error(getErrorMessage(error))
        }
    },

    /**
     * Login with Apple
     */
    async loginWithApple(): Promise<AuthResponse> {
        try {
            const result = await signInWithPopup(auth, appleProvider)
            return { user: mapFirebaseUserToAppUser(result.user) }
        } catch (error: unknown) {
            throw new Error(getErrorMessage(error))
        }
    },

    /**
     * Logout current user
     */
    async logout(): Promise<void> {
        try {
            await signOut(auth)
        } catch (error: unknown) {
            throw new Error(getErrorMessage(error))
        }
    },

    /**
     * Get current user
     */
    getCurrentUser(): User | null {
        const firebaseUser = auth.currentUser
        return firebaseUser ? mapFirebaseUserToAppUser(firebaseUser) : null
    },

    /**
     * Check if user is authenticated
     */
    isAuthenticated(): boolean {
        return !!auth.currentUser
    },
}

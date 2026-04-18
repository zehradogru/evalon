import type { FirebaseError } from 'firebase/app'
import {
    createUserWithEmailAndPassword,
    reload,
    sendEmailVerification,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut,
    updateProfile,
    User as FirebaseUser,
} from 'firebase/auth'
import { appleProvider, auth, googleProvider } from '@/lib/firebase'
import {
    mapFirebaseUserToAppUser,
    normalizeAuthEmail,
    normalizeDisplayName,
    shouldRequireEmailVerification,
    waitAtLeast,
} from '@/lib/auth-utils'
import { profileService } from '@/services/profile.service'
import type { User } from '@/types'

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
    requiresEmailVerification: boolean
}

function isFirebaseError(error: unknown): error is FirebaseError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as { code?: unknown }).code === 'string'
    )
}

async function buildAuthResponse(firebaseUser: FirebaseUser): Promise<AuthResponse> {
    let authSecurity = null

    try {
        authSecurity = await profileService.getAuthSecurityByUserId(firebaseUser.uid)
    } catch {
        authSecurity = null
    }

    const user = mapFirebaseUserToAppUser(firebaseUser, authSecurity)

    return {
        user,
        requiresEmailVerification: shouldRequireEmailVerification(user),
    }
}

function getLoginErrorMessage(error: unknown): string {
    const errorCode = isFirebaseError(error) ? error.code : undefined

    switch (errorCode) {
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait and try again.'
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection and try again.'
        default:
            return 'Sign in failed. Check your credentials and try again.'
    }
}

function getSignupErrorMessage(error: unknown): string {
    const errorCode = isFirebaseError(error) ? error.code : undefined

    switch (errorCode) {
        case 'auth/too-many-requests':
            return 'Too many attempts. Please wait and try again.'
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection and try again.'
        default:
            return 'Could not create your account. Review your details and try again.'
    }
}

function getOAuthErrorMessage(error: unknown): string {
    const errorCode = isFirebaseError(error) ? error.code : undefined

    switch (errorCode) {
        case 'auth/popup-closed-by-user':
            return 'Sign-in was cancelled before it could complete.'
        case 'auth/cancelled-popup-request':
            return 'Another sign-in request is already in progress.'
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection and try again.'
        default:
            return 'Could not complete sign-in. Please try again.'
    }
}

function getVerificationEmailErrorMessage(error: unknown): string {
    const errorCode = isFirebaseError(error) ? error.code : undefined

    switch (errorCode) {
        case 'auth/too-many-requests':
            return 'Too many requests. Please wait before sending another email.'
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection and try again.'
        default:
            return 'Could not send a verification email right now. Please try again.'
    }
}

function getPasswordResetErrorMessage(error: unknown): string {
    const errorCode = isFirebaseError(error) ? error.code : undefined

    switch (errorCode) {
        case 'auth/invalid-email':
            return 'Enter a valid email address.'
        case 'auth/too-many-requests':
            return 'Too many requests. Please wait before trying again.'
        case 'auth/network-request-failed':
            return 'Network error. Please check your connection and try again.'
        default:
            return 'Could not process your request right now. Please try again.'
    }
}

export const authService = {
    async login(credentials: LoginCredentials): Promise<AuthResponse> {
        const startedAt = Date.now()

        try {
            const userCredential = await signInWithEmailAndPassword(
                auth,
                normalizeAuthEmail(credentials.email),
                credentials.password
            )

            return buildAuthResponse(userCredential.user)
        } catch (error: unknown) {
            throw new Error(getLoginErrorMessage(error))
        } finally {
            await waitAtLeast(startedAt)
        }
    },

    async signup(data: SignupData): Promise<AuthResponse> {
        const startedAt = Date.now()
        const normalizedEmail = normalizeAuthEmail(data.email)
        const normalizedName = normalizeDisplayName(data.name)

        try {
            const userCredential = await createUserWithEmailAndPassword(
                auth,
                normalizedEmail,
                data.password
            )

            await updateProfile(userCredential.user, {
                displayName: normalizedName,
            })

            await profileService.upsertAuthSecurity(userCredential.user, {
                verificationRequired: true,
                createdWithProvider: 'password',
                displayName: normalizedName,
            })

            await sendEmailVerification(userCredential.user)

            return buildAuthResponse(userCredential.user)
        } catch (error: unknown) {
            throw new Error(getSignupErrorMessage(error))
        } finally {
            await waitAtLeast(startedAt)
        }
    },

    async loginWithGoogle(): Promise<AuthResponse> {
        const startedAt = Date.now()

        try {
            const result = await signInWithPopup(auth, googleProvider)
            try {
                const existingAuthSecurity =
                    await profileService.getAuthSecurityByUserId(result.user.uid)

                if (!existingAuthSecurity) {
                    await profileService.upsertAuthSecurity(result.user, {
                        verificationRequired: false,
                        createdWithProvider: 'google',
                        displayName: result.user.displayName || undefined,
                    })
                }
            } catch {
                // Google sign-in should keep working even if profile metadata cannot be written.
            }

            return buildAuthResponse(result.user)
        } catch (error: unknown) {
            throw new Error(getOAuthErrorMessage(error))
        } finally {
            await waitAtLeast(startedAt)
        }
    },

    async loginWithApple(): Promise<AuthResponse> {
        const startedAt = Date.now()

        try {
            const result = await signInWithPopup(auth, appleProvider)
            return buildAuthResponse(result.user)
        } catch (error: unknown) {
            throw new Error(getOAuthErrorMessage(error))
        } finally {
            await waitAtLeast(startedAt)
        }
    },

    async logout(): Promise<void> {
        try {
            await signOut(auth)
        } catch (error: unknown) {
            throw new Error(
                error instanceof Error ? error.message : 'Could not sign out right now.'
            )
        }
    },

    async sendPasswordReset(email: string): Promise<void> {
        const startedAt = Date.now()

        try {
            await sendPasswordResetEmail(auth, normalizeAuthEmail(email))
        } catch (error: unknown) {
            const errorCode = isFirebaseError(error) ? error.code : undefined

            if (
                errorCode !== 'auth/user-not-found' &&
                errorCode !== 'auth/invalid-credential'
            ) {
                throw new Error(getPasswordResetErrorMessage(error))
            }
        } finally {
            await waitAtLeast(startedAt)
        }
    },

    async resendVerificationEmail(): Promise<void> {
        const startedAt = Date.now()
        const firebaseUser = auth.currentUser

        if (!firebaseUser) {
            throw new Error('Please sign in again to continue.')
        }

        try {
            await sendEmailVerification(firebaseUser)
        } catch (error: unknown) {
            throw new Error(getVerificationEmailErrorMessage(error))
        } finally {
            await waitAtLeast(startedAt)
        }
    },

    async refreshCurrentUser(): Promise<AuthResponse | null> {
        const startedAt = Date.now()
        const firebaseUser = auth.currentUser

        if (!firebaseUser) {
            return null
        }

        try {
            await reload(firebaseUser)
            const nextUser = auth.currentUser || firebaseUser
            return buildAuthResponse(nextUser)
        } finally {
            await waitAtLeast(startedAt)
        }
    },

    getCurrentUser(): User | null {
        const firebaseUser = auth.currentUser
        return firebaseUser ? mapFirebaseUserToAppUser(firebaseUser) : null
    },

    isAuthenticated(): boolean {
        return !!auth.currentUser
    },
}

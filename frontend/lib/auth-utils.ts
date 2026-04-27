import type { User as FirebaseUser } from 'firebase/auth'
import type { AuthSecurityState, User } from '@/types'

export const AUTH_MIN_RESPONSE_DELAY_MS = 900
export const AUTH_SECURITY_ROLLOUT_VERSION = 1
export const PASSWORD_MIN_LENGTH = 10

export interface PasswordPolicyState {
    hasMinimumLength: boolean
    hasUppercase: boolean
    hasLowercase: boolean
    hasNumeric: boolean
}

export function normalizeAuthEmail(email: string): string {
    return email.trim().toLowerCase()
}

export function isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
}

export function normalizeDisplayName(value: string): string {
    return value.trim().replace(/\s+/g, ' ')
}

export function getPasswordPolicyState(password: string): PasswordPolicyState {
    return {
        hasMinimumLength: password.length >= PASSWORD_MIN_LENGTH,
        hasUppercase: /[A-Z]/.test(password),
        hasLowercase: /[a-z]/.test(password),
        hasNumeric: /\d/.test(password),
    }
}

export function isPasswordPolicySatisfied(password: string): boolean {
    const policy = getPasswordPolicyState(password)
    return Object.values(policy).every(Boolean)
}

export async function waitAtLeast(
    startedAt: number,
    minimumDelayMs: number = AUTH_MIN_RESPONSE_DELAY_MS
): Promise<void> {
    const elapsed = Date.now() - startedAt
    const remaining = Math.max(0, minimumDelayMs - elapsed)

    if (remaining === 0) return

    await new Promise((resolve) => {
        setTimeout(resolve, remaining)
    })
}

export function shouldRequireEmailVerification(
    user: Pick<User, 'emailVerified' | 'authSecurity'> | null
): boolean {
    return Boolean(user?.authSecurity?.verificationRequired && !user.emailVerified)
}

export function mapFirebaseUserToAppUser(
    firebaseUser: FirebaseUser,
    authSecurity: AuthSecurityState | null = null
): User {
    return {
        id: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: firebaseUser.displayName || undefined,
        photoURL: firebaseUser.photoURL || undefined,
        createdAt:
            firebaseUser.metadata.creationTime || new Date().toISOString(),
        emailVerified: firebaseUser.emailVerified,
        authSecurity,
    }
}

import { updateProfile as updateFirebaseProfile, User as FirebaseUser } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import {
    deleteObject,
    getDownloadURL,
    ref as storageRef,
    uploadBytes,
} from 'firebase/storage'
import { auth, db, storage } from '@/lib/firebase'
import { AUTH_SECURITY_ROLLOUT_VERSION } from '@/lib/auth-utils'
import type {
    AppCurrency,
    AppLanguage,
    AppTheme,
    AuthSecurityProvider,
    AuthSecurityState,
    NotificationPreferences,
    UserPlan,
    UserPreferences,
    UserProfile,
} from '@/types'

const USERS_COLLECTION = 'users'
const DEFAULT_PLAN: UserPlan = 'Free'
const PROFILE_PHOTO_MAX_SIZE_BYTES = 5 * 1024 * 1024
const DEFAULT_PREFERENCES: UserPreferences = {
    language: 'en',
    currency: 'USD',
    theme: 'dark',
    notifications: {
        pushEnabled: false,
        priceAlerts: true,
        indicatorAlerts: true,
        newsAlerts: false,
        newsDigest: false,
    },
}

const LANGUAGE_VALUES: AppLanguage[] = ['en', 'tr', 'de']
const CURRENCY_VALUES: AppCurrency[] = ['USD', 'TRY', 'EUR']
const THEME_VALUES: AppTheme[] = ['dark', 'light']
const PLAN_VALUES: UserPlan[] = ['Free', 'Pro Trader']
const ALLOWED_PROFILE_PHOTO_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
])

export interface UpdateProfilePayload {
    displayName: string
    photoURL?: string | null
}

export interface UpdatePreferencesPayload {
    language?: AppLanguage
    currency?: AppCurrency
    theme?: AppTheme
    notifications?: Partial<NotificationPreferences>
}

export interface UpsertAuthSecurityPayload {
    verificationRequired: boolean
    createdWithProvider: AuthSecurityProvider
    displayName?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function isLanguage(value: unknown): value is AppLanguage {
    return typeof value === 'string' && LANGUAGE_VALUES.includes(value as AppLanguage)
}

function isCurrency(value: unknown): value is AppCurrency {
    return typeof value === 'string' && CURRENCY_VALUES.includes(value as AppCurrency)
}

function isTheme(value: unknown): value is AppTheme {
    return typeof value === 'string' && THEME_VALUES.includes(value as AppTheme)
}

function isPlan(value: unknown): value is UserPlan {
    return typeof value === 'string' && PLAN_VALUES.includes(value as UserPlan)
}

function isAuthSecurityProvider(value: unknown): value is AuthSecurityProvider {
    return value === 'password' || value === 'google'
}

function normalizeAuthSecurity(value: unknown): AuthSecurityState | null {
    if (!isRecord(value)) {
        return null
    }

    if (
        typeof value.verificationRequired !== 'boolean' ||
        typeof value.rolloutVersion !== 'number' ||
        !isAuthSecurityProvider(value.createdWithProvider)
    ) {
        return null
    }

    return {
        verificationRequired: value.verificationRequired,
        rolloutVersion: value.rolloutVersion,
        createdWithProvider: value.createdWithProvider,
    }
}

function normalizePreferences(value: unknown): UserPreferences {
    const raw = isRecord(value) ? value : {}
    const rawNotifications = isRecord(raw.notifications) ? raw.notifications : {}

    return {
        language: isLanguage(raw.language) ? raw.language : DEFAULT_PREFERENCES.language,
        currency: isCurrency(raw.currency) ? raw.currency : DEFAULT_PREFERENCES.currency,
        theme: isTheme(raw.theme) ? raw.theme : DEFAULT_PREFERENCES.theme,
        notifications: {
            pushEnabled:
                typeof rawNotifications.pushEnabled === 'boolean'
                    ? rawNotifications.pushEnabled
                    : DEFAULT_PREFERENCES.notifications.pushEnabled,
            priceAlerts:
                typeof rawNotifications.priceAlerts === 'boolean'
                    ? rawNotifications.priceAlerts
                    : DEFAULT_PREFERENCES.notifications.priceAlerts,
            indicatorAlerts:
                typeof rawNotifications.indicatorAlerts === 'boolean'
                    ? rawNotifications.indicatorAlerts
                    : DEFAULT_PREFERENCES.notifications.indicatorAlerts,
            newsAlerts:
                typeof rawNotifications.newsAlerts === 'boolean'
                    ? rawNotifications.newsAlerts
                    : DEFAULT_PREFERENCES.notifications.newsAlerts,
            newsDigest:
                typeof rawNotifications.newsDigest === 'boolean'
                    ? rawNotifications.newsDigest
                    : DEFAULT_PREFERENCES.notifications.newsDigest,
        },
    }
}

function buildProfileFromAuth(firebaseUser: FirebaseUser): UserProfile {
    const now = new Date().toISOString()
    return {
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        displayName: firebaseUser.displayName || '',
        photoURL: firebaseUser.photoURL || null,
        plan: DEFAULT_PLAN,
        createdAt: firebaseUser.metadata.creationTime || now,
        updatedAt: now,
        preferences: DEFAULT_PREFERENCES,
        authSecurity: null,
    }
}

function normalizeProfileFromDoc(rawData: unknown, firebaseUser: FirebaseUser): UserProfile {
    const fallback = buildProfileFromAuth(firebaseUser)
    if (!isRecord(rawData)) {
        return fallback
    }

    return {
        uid: firebaseUser.uid,
        email: typeof rawData.email === 'string' ? rawData.email : fallback.email,
        displayName:
            typeof rawData.displayName === 'string'
                ? rawData.displayName
                : fallback.displayName,
        photoURL:
            typeof rawData.photoURL === 'string'
                ? rawData.photoURL
                : rawData.photoURL === null
                  ? null
                  : fallback.photoURL,
        plan: isPlan(rawData.plan) ? rawData.plan : fallback.plan,
        createdAt:
            typeof rawData.createdAt === 'string'
                ? rawData.createdAt
                : fallback.createdAt,
        updatedAt:
            typeof rawData.updatedAt === 'string'
                ? rawData.updatedAt
                : fallback.updatedAt,
        preferences: normalizePreferences(rawData.preferences),
        authSecurity: normalizeAuthSecurity(rawData.authSecurity),
    }
}

function ensureCurrentUser(): FirebaseUser {
    const firebaseUser = auth.currentUser
    if (!firebaseUser) {
        throw new Error('User is not authenticated')
    }
    return firebaseUser
}

function mergePreferences(
    current: UserPreferences,
    updates: UpdatePreferencesPayload
): UserPreferences {
    return {
        language: updates.language ?? current.language,
        currency: updates.currency ?? current.currency,
        theme: updates.theme ?? current.theme,
        notifications: {
            pushEnabled:
                updates.notifications?.pushEnabled ??
                current.notifications.pushEnabled,
            priceAlerts:
                updates.notifications?.priceAlerts ?? current.notifications.priceAlerts,
            indicatorAlerts:
                updates.notifications?.indicatorAlerts ??
                current.notifications.indicatorAlerts,
            newsAlerts:
                updates.notifications?.newsAlerts ?? current.notifications.newsAlerts,
            newsDigest:
                updates.notifications?.newsDigest ?? current.notifications.newsDigest,
        },
    }
}

function validateProfilePhotoFile(file: File): void {
    if (!ALLOWED_PROFILE_PHOTO_TYPES.has(file.type)) {
        throw new Error('Only JPEG, PNG, and WEBP images are supported')
    }

    if (file.size > PROFILE_PHOTO_MAX_SIZE_BYTES) {
        throw new Error('Profile photo must be smaller than 5MB')
    }
}

function getProfilePhotoExtension(file: File): string {
    switch (file.type) {
        case 'image/png':
            return 'png'
        case 'image/webp':
            return 'webp'
        default:
            return 'jpg'
    }
}

function isManagedProfilePhotoURL(photoURL: string, userId: string): boolean {
    const bucketName = storage.app.options.storageBucket
    if (!bucketName || photoURL.startsWith('data:image')) {
        return false
    }

    const decodedUrl = decodeURIComponent(photoURL)
    return decodedUrl.includes(bucketName) && decodedUrl.includes(`users/${userId}/profile/`)
}

export const profileService = {
    async getAuthSecurityByUserId(userId: string): Promise<AuthSecurityState | null> {
        const userRef = doc(db, USERS_COLLECTION, userId)
        const snapshot = await getDoc(userRef)
        if (!snapshot.exists()) {
            return null
        }

        return normalizeAuthSecurity(snapshot.data().authSecurity)
    },

    async upsertAuthSecurity(
        firebaseUser: FirebaseUser,
        payload: UpsertAuthSecurityPayload
    ): Promise<AuthSecurityState> {
        const now = new Date().toISOString()
        const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid)
        const snapshot = await getDoc(userRef)

        const authSecurity: AuthSecurityState = {
            verificationRequired: payload.verificationRequired,
            rolloutVersion: AUTH_SECURITY_ROLLOUT_VERSION,
            createdWithProvider: payload.createdWithProvider,
        }

        const nextData: Record<string, unknown> = {
            email: firebaseUser.email || '',
            displayName:
                payload.displayName ??
                firebaseUser.displayName ??
                '',
            photoURL: firebaseUser.photoURL || null,
            updatedAt: now,
            authSecurity,
        }

        if (!snapshot.exists()) {
            nextData.uid = firebaseUser.uid
            nextData.plan = DEFAULT_PLAN
            nextData.createdAt = firebaseUser.metadata.creationTime || now
            nextData.preferences = DEFAULT_PREFERENCES
        }

        await setDoc(userRef, nextData, { merge: true })

        return authSecurity
    },

    async getOrCreateProfile(): Promise<UserProfile> {
        const firebaseUser = ensureCurrentUser()
        const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid)
        const snapshot = await getDoc(userRef)

        if (!snapshot.exists()) {
            const profile = buildProfileFromAuth(firebaseUser)
            await setDoc(userRef, profile, { merge: true })
            return profile
        }

        const normalizedProfile = normalizeProfileFromDoc(
            snapshot.data(),
            firebaseUser
        )

        // Keep auth source of truth synced for core identity fields.
        const syncedProfile: UserProfile = {
            ...normalizedProfile,
            email: firebaseUser.email || normalizedProfile.email,
            displayName: firebaseUser.displayName || normalizedProfile.displayName,
            photoURL: firebaseUser.photoURL || normalizedProfile.photoURL,
        }

        return syncedProfile
    },

    async updateProfile(payload: UpdateProfilePayload): Promise<UserProfile> {
        const firebaseUser = ensureCurrentUser()
        const nextDisplayName = payload.displayName.trim()
        if (!nextDisplayName) {
            throw new Error('Display name cannot be empty')
        }

        const authUpdate: {
            displayName?: string | null
            photoURL?: string | null
        } = { displayName: nextDisplayName }

        if (payload.photoURL !== undefined) {
            authUpdate.photoURL = payload.photoURL
        }

        await updateFirebaseProfile(firebaseUser, authUpdate)

        const currentProfile = await this.getOrCreateProfile()
        const updatedProfile: UserProfile = {
            ...currentProfile,
            email: firebaseUser.email || currentProfile.email,
            displayName: nextDisplayName,
            photoURL:
                payload.photoURL !== undefined
                    ? payload.photoURL
                    : currentProfile.photoURL,
            updatedAt: new Date().toISOString(),
        }

        const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid)
        await setDoc(userRef, updatedProfile, { merge: true })
        return updatedProfile
    },

    async uploadProfilePhoto(file: File): Promise<UserProfile> {
        const firebaseUser = ensureCurrentUser()
        validateProfilePhotoFile(file)

        const currentProfile = await this.getOrCreateProfile()
        const extension = getProfilePhotoExtension(file)
        const objectPath = `users/${firebaseUser.uid}/profile/avatar-${Date.now()}.${extension}`
        const nextPhotoRef = storageRef(storage, objectPath)

        await uploadBytes(nextPhotoRef, file, {
            contentType: file.type,
            cacheControl: 'public,max-age=3600',
        })
        const nextPhotoURL = await getDownloadURL(nextPhotoRef)

        await updateFirebaseProfile(firebaseUser, { photoURL: nextPhotoURL })

        const updatedProfile: UserProfile = {
            ...currentProfile,
            photoURL: nextPhotoURL,
            updatedAt: new Date().toISOString(),
        }

        const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid)
        await setDoc(userRef, updatedProfile, { merge: true })

        if (
            currentProfile.photoURL &&
            currentProfile.photoURL !== nextPhotoURL &&
            isManagedProfilePhotoURL(currentProfile.photoURL, firebaseUser.uid)
        ) {
            try {
                await deleteObject(storageRef(storage, currentProfile.photoURL))
            } catch {
                // Ignore cleanup errors for old profile photos.
            }
        }

        return updatedProfile
    },

    async updatePreferences(payload: UpdatePreferencesPayload): Promise<UserProfile> {
        const firebaseUser = ensureCurrentUser()
        const currentProfile = await this.getOrCreateProfile()
        const updatedProfile: UserProfile = {
            ...currentProfile,
            preferences: mergePreferences(currentProfile.preferences, payload),
            updatedAt: new Date().toISOString(),
        }

        const userRef = doc(db, USERS_COLLECTION, firebaseUser.uid)
        await setDoc(userRef, updatedProfile, { merge: true })
        return updatedProfile
    },
}

import type { FirebaseError } from 'firebase/app'
import {
    deleteDoc,
    getDoc,
    getDocs,
    limit,
    orderBy,
    type QueryConstraint,
    query,
    runTransaction,
    serverTimestamp,
    startAfter,
    Timestamp,
    updateDoc,
    where,
} from 'firebase/firestore'
import {
    deleteObject,
    getDownloadURL,
    ref as storageRef,
    uploadBytes,
} from 'firebase/storage'

import { auth, storage } from '@/lib/firebase'
import {
    buildCommunityImageStoragePath,
    COMMUNITY_CONTENT_MAX,
    COMMUNITY_MAX_TAGS,
    COMMUNITY_MAX_TICKERS,
    COMMUNITY_PAGE_SIZE,
    getCommunityImageExtension,
    isManagedCommunityImagePath,
    matchesTickerFilter,
    normalizeCommunityDraft,
    normalizeTicker,
    validateCommunityImageFile,
} from '@/lib/community'
import {
    postDoc,
    postReportDoc,
    postsCollection,
    userDoc,
    userLikeDoc,
    userSaveDoc,
    userSavesCollection,
} from '@/lib/community-firestore'
import type {
    CommunityFeedCursor,
    CommunityFeedFilter,
    CommunityFeedPage,
    CommunityPost,
    CommunityPostDraft,
    CommunityPostRecord,
    CommunityRelatedGroup,
    CommunityReportReason,
} from '@/types'

interface CommunityViewerFlags {
    likedIds: Set<string>
    savedIds: Set<string>
}

interface GetFeedPageParams {
    filter: CommunityFeedFilter
    ticker?: string | null
    cursor?: CommunityFeedCursor | null
    userId?: string | null
}

interface ToggleLikeResult {
    liked: boolean
    likeCount: number
}

interface ToggleSaveResult {
    saved: boolean
}

interface ReportPostResult {
    reportCount: number
}

interface UploadedCommunityImage {
    url: string
    path: string
    width: number
    height: number
}

type CommunityImageFields = Pick<
    CommunityPostRecord,
    'imageUrl' | 'imagePath' | 'imageWidth' | 'imageHeight'
>

function isFirebaseError(error: unknown): error is FirebaseError {
    return (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        typeof (error as { code?: unknown }).code === 'string'
    )
}

function getCommunityPublishErrorMessage(
    error: unknown,
    stage: 'image-upload' | 'firestore-write' | 'image-delete'
) {
    const errorCode = isFirebaseError(error) ? error.code : undefined

    if (stage === 'image-upload') {
        switch (errorCode) {
            case 'storage/unauthorized':
            case 'storage/unauthenticated':
                return 'Image upload was blocked by Firebase Storage permissions.'
            case 'storage/canceled':
                return 'Image upload was cancelled before it completed.'
            case 'storage/unknown':
                return 'Image upload failed. Please retry once.'
            default:
                return error instanceof Error
                    ? error.message
                    : 'Image upload failed before the post could be published.'
        }
    }

    if (stage === 'firestore-write') {
        switch (errorCode) {
            case 'permission-denied':
                return 'Post write was blocked by Firestore rules or missing permissions.'
            case 'unauthenticated':
                return 'Your session is not authenticated for posting right now.'
            case 'failed-precondition':
                return 'The post could not be saved because Firebase rejected the current write conditions.'
            default:
                return error instanceof Error
                    ? error.message
                    : 'Post write failed before publish could complete.'
        }
    }

    return error instanceof Error
        ? error.message
        : 'Managed community image cleanup failed.'
}

function logCommunityError(
    label: string,
    error: unknown,
    extra?: Record<string, unknown>
) {
    console.error(`[community] ${label}`, {
        ...(extra ?? {}),
        code: isFirebaseError(error) ? error.code : undefined,
        message: error instanceof Error ? error.message : String(error),
        error,
    })
}

function ensureAuthenticatedUser() {
    const currentUser = auth.currentUser
    if (!currentUser) {
        throw new Error('You need to sign in to use community actions.')
    }
    return currentUser
}

function getAuthorName() {
    const currentUser = ensureAuthenticatedUser()
    return (
        currentUser.displayName?.trim() ||
        currentUser.email?.split('@')[0]?.trim() ||
        'Trader'
    )
}

function buildEmptyImageFields(): CommunityImageFields {
    return {
        imageUrl: null,
        imagePath: null,
        imageWidth: null,
        imageHeight: null,
    }
}

function getImageFieldsFromRecord(record: CommunityPostRecord): CommunityImageFields {
    return {
        imageUrl: record.imageUrl ?? null,
        imagePath: record.imagePath ?? null,
        imageWidth: record.imageWidth ?? null,
        imageHeight: record.imageHeight ?? null,
    }
}

function validateDraft(draft: CommunityPostDraft) {
    const normalized = normalizeCommunityDraft(draft)

    if (!normalized.content) {
        throw new Error('Post content cannot be empty.')
    }

    if (normalized.content.length > COMMUNITY_CONTENT_MAX) {
        throw new Error(
            `Post content must be ${COMMUNITY_CONTENT_MAX} characters or fewer.`
        )
    }

    if (normalized.tickers.length > COMMUNITY_MAX_TICKERS) {
        throw new Error(`You can add up to ${COMMUNITY_MAX_TICKERS} tickers.`)
    }

    if (normalized.tags.length > COMMUNITY_MAX_TAGS) {
        throw new Error(`You can add up to ${COMMUNITY_MAX_TAGS} tags.`)
    }

    if (normalized.image?.file) {
        const imageError = validateCommunityImageFile(normalized.image.file)

        if (imageError) {
            throw new Error(imageError)
        }
    }

    return normalized
}

function toIsoString(value: Timestamp | null) {
    return value ? value.toDate().toISOString() : null
}

async function readImageDimensions(file: File) {
    return new Promise<{ width: number; height: number }>((resolve, reject) => {
        const objectUrl = URL.createObjectURL(file)
        const image = new Image()

        image.onload = () => {
            resolve({
                width: image.naturalWidth || image.width,
                height: image.naturalHeight || image.height,
            })
            URL.revokeObjectURL(objectUrl)
        }

        image.onerror = () => {
            URL.revokeObjectURL(objectUrl)
            reject(new Error('Unable to read the selected image.'))
        }

        image.src = objectUrl
    })
}

async function uploadCommunityImage({
    userId,
    postId,
    file,
}: {
    userId: string
    postId: string
    file: File
}): Promise<UploadedCommunityImage> {
    const imageError = validateCommunityImageFile(file)

    if (imageError) {
        throw new Error(imageError)
    }

    const extension = getCommunityImageExtension(file)
    const path = buildCommunityImageStoragePath({
        userId,
        postId,
        extension,
    })
    const dimensions = await readImageDimensions(file)
    const imageRef = storageRef(storage, path)

    await uploadBytes(imageRef, file, {
        contentType: file.type,
        cacheControl: 'public,max-age=3600',
    })

    return {
        url: await getDownloadURL(imageRef),
        path,
        width: dimensions.width,
        height: dimensions.height,
    }
}

async function safelyDeleteCommunityImage(path?: string | null) {
    if (!path) return

    try {
        await deleteObject(storageRef(storage, path))
    } catch {
        // Ignore cleanup failures for managed community images.
    }
}

function mapPostRecord(
    id: string,
    record: CommunityPostRecord,
    viewerFlags: CommunityViewerFlags,
    currentUserId?: string | null
): CommunityPost {
    return {
        id,
        content: record.content,
        tickers: record.tickers,
        tags: record.tags,
        authorId: record.authorId,
        authorName: record.authorName,
        createdAt: record.createdAt.toDate().toISOString(),
        editedAt: toIsoString(record.editedAt),
        likeCount: record.likeCount,
        reportCount: record.reportCount,
        imageUrl: record.imageUrl ?? null,
        imagePath: record.imagePath ?? null,
        imageWidth: record.imageWidth ?? null,
        imageHeight: record.imageHeight ?? null,
        viewerHasLiked: viewerFlags.likedIds.has(id),
        viewerHasSaved: viewerFlags.savedIds.has(id),
        isMine: Boolean(currentUserId && record.authorId === currentUserId),
    }
}

async function loadViewerFlags(
    postIds: string[],
    userId?: string | null
): Promise<CommunityViewerFlags> {
    if (!userId || postIds.length === 0) {
        return {
            likedIds: new Set<string>(),
            savedIds: new Set<string>(),
        }
    }

    const [likeDocs, saveDocs] = await Promise.all([
        Promise.all(postIds.map((postId) => getDoc(userLikeDoc(userId, postId)))),
        Promise.all(postIds.map((postId) => getDoc(userSaveDoc(userId, postId)))),
    ])

    return {
        likedIds: new Set(
            likeDocs.filter((snapshot) => snapshot.exists()).map((snapshot) => snapshot.id)
        ),
        savedIds: new Set(
            saveDocs.filter((snapshot) => snapshot.exists()).map((snapshot) => snapshot.id)
        ),
    }
}

async function mapSnapshotsToPosts(
    snapshots: Array<{ id: string; data: CommunityPostRecord }>,
    userId?: string | null
) {
    const viewerFlags = await loadViewerFlags(
        snapshots.map((snapshot) => snapshot.id),
        userId
    )

    return snapshots.map((snapshot) =>
        mapPostRecord(snapshot.id, snapshot.data, viewerFlags, userId)
    )
}

async function buildSavedFeedPage(
    params: GetFeedPageParams
): Promise<CommunityFeedPage> {
    if (!params.userId) {
        return {
            items: [],
            nextCursor: null,
            hasMore: false,
        }
    }

    let cursor = params.cursor ?? null
    let nextCursor: CommunityFeedCursor | null = null
    let hasMore = false
    const hydrated: CommunityPost[] = []
    const normalizedTicker = params.ticker ? normalizeTicker(params.ticker) : null

    while (hydrated.length < COMMUNITY_PAGE_SIZE) {
        const constraints: QueryConstraint[] = [
            orderBy('createdAt', 'desc'),
            limit(COMMUNITY_PAGE_SIZE + 1),
        ]

        if (cursor) {
            constraints.push(startAfter(cursor))
        }

        const markerSnapshot = await getDocs(
            query(userSavesCollection(params.userId), ...constraints)
        )

        if (markerSnapshot.empty) {
            nextCursor = null
            hasMore = false
            break
        }

        const markerDocs = markerSnapshot.docs.slice(0, COMMUNITY_PAGE_SIZE)

        cursor = markerDocs[markerDocs.length - 1] as CommunityFeedCursor
        nextCursor = cursor
        hasMore = markerSnapshot.docs.length > COMMUNITY_PAGE_SIZE

        const postSnapshots = await Promise.all(
            markerDocs.map(async (markerDoc) => {
                const postSnapshot = await getDoc(postDoc(markerDoc.id))
                return postSnapshot.exists()
                    ? {
                          id: postSnapshot.id,
                          data: postSnapshot.data(),
                      }
                    : null
            })
        )

        const posts = await mapSnapshotsToPosts(
            postSnapshots.filter(Boolean) as Array<{
                id: string
                data: CommunityPostRecord
            }>,
            params.userId
        )

        posts
            .filter((post) => matchesTickerFilter(post, normalizedTicker))
            .forEach((post) => {
                if (hydrated.length < COMMUNITY_PAGE_SIZE) {
                    hydrated.push(post)
                }
            })

        if (!hasMore) {
            break
        }
    }

    return {
        items: hydrated,
        nextCursor: hasMore ? nextCursor : null,
        hasMore,
    }
}

async function buildScannedFeedPage(
    params: GetFeedPageParams
): Promise<CommunityFeedPage> {
    if (params.filter === 'mine' && !params.userId) {
        return {
            items: [],
            nextCursor: null,
            hasMore: false,
        }
    }

    let cursor = params.cursor ?? null
    let nextCursor: CommunityFeedCursor | null = null
    let hasMore = false
    const hydrated: CommunityPost[] = []
    const normalizedTicker = params.ticker ? normalizeTicker(params.ticker) : null

    while (hydrated.length < COMMUNITY_PAGE_SIZE) {
        const constraints: QueryConstraint[] = [
            orderBy('createdAt', 'desc'),
            limit(COMMUNITY_PAGE_SIZE + 1),
        ]

        if (cursor) {
            constraints.push(startAfter(cursor))
        }

        const snapshot = await getDocs(query(postsCollection(), ...constraints))

        if (snapshot.empty) {
            nextCursor = null
            hasMore = false
            break
        }

        const pageDocs = snapshot.docs.slice(0, COMMUNITY_PAGE_SIZE)
        cursor = pageDocs[pageDocs.length - 1] as CommunityFeedCursor
        nextCursor = cursor
        hasMore = snapshot.docs.length > COMMUNITY_PAGE_SIZE

        const items = await mapSnapshotsToPosts(
            pageDocs.map((docSnapshot) => ({
                id: docSnapshot.id,
                data: docSnapshot.data(),
            })),
            params.userId
        )

        items
            .filter((post) => {
                if (params.filter === 'mine' && post.authorId !== params.userId) {
                    return false
                }

                return matchesTickerFilter(post, normalizedTicker)
            })
            .forEach((post) => {
                if (hydrated.length < COMMUNITY_PAGE_SIZE) {
                    hydrated.push(post)
                }
            })

        if (!hasMore) {
            break
        }
    }

    return {
        items: hydrated,
        nextCursor: hasMore ? nextCursor : null,
        hasMore,
    }
}

async function buildQueriedFeedPage(
    params: GetFeedPageParams
): Promise<CommunityFeedPage> {
    const constraints: QueryConstraint[] = []

    if (params.ticker) {
        constraints.push(where('tickers', 'array-contains', normalizeTicker(params.ticker)))
    }

    constraints.push(orderBy('createdAt', 'desc'))

    if (params.cursor) {
        constraints.push(startAfter(params.cursor))
    }

    constraints.push(limit(COMMUNITY_PAGE_SIZE + 1))

    const snapshot = await getDocs(query(postsCollection(), ...constraints))
    const pageDocs = snapshot.docs.slice(0, COMMUNITY_PAGE_SIZE)
    const nextCursor =
        snapshot.docs.length > COMMUNITY_PAGE_SIZE
            ? (pageDocs[pageDocs.length - 1] as CommunityFeedCursor)
            : null

    const items = await mapSnapshotsToPosts(
        pageDocs.map((docSnapshot) => ({
            id: docSnapshot.id,
            data: docSnapshot.data(),
        })),
        params.userId
    )

    return {
        items,
        nextCursor,
        hasMore: snapshot.docs.length > COMMUNITY_PAGE_SIZE,
    }
}

export class CommunityAlreadyReportedError extends Error {
    constructor() {
        super('You already reported this post.')
        this.name = 'CommunityAlreadyReportedError'
    }
}

export const communityService = {
    async getFeedPage(params: GetFeedPageParams): Promise<CommunityFeedPage> {
        if (params.filter === 'saved') {
            return buildSavedFeedPage(params)
        }

        if (params.filter === 'mine') {
            return buildScannedFeedPage(params)
        }

        return buildQueriedFeedPage(params)
    },

    async getPost(postId: string, userId?: string | null): Promise<CommunityPost | null> {
        const snapshot = await getDoc(postDoc(postId))

        if (!snapshot.exists()) {
            return null
        }

        const viewerFlags = await loadViewerFlags([postId], userId)
        return mapPostRecord(snapshot.id, snapshot.data(), viewerFlags, userId)
    },

    async createPost(draft: CommunityPostDraft): Promise<CommunityPost> {
        const currentUser = ensureAuthenticatedUser()
        const postId =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
        const postRef = postDoc(postId)
        const normalizedDraft = validateDraft(draft)
        let uploadedImage: UploadedCommunityImage | null = null

        if (normalizedDraft.image?.file) {
            try {
                uploadedImage = await uploadCommunityImage({
                    userId: currentUser.uid,
                    postId,
                    file: normalizedDraft.image.file,
                })
            } catch (error) {
                logCommunityError('create image upload failed', error, {
                    postId,
                    userId: currentUser.uid,
                })
                throw new Error(
                    getCommunityPublishErrorMessage(error, 'image-upload')
                )
            }
        }

        try {
            await runTransaction(postRef.firestore, async (transaction) => {
                const authorProfile = await transaction.get(userDoc(currentUser.uid))
                const authorName =
                    (authorProfile.exists() &&
                        typeof authorProfile.data()?.displayName === 'string' &&
                        authorProfile.data()?.displayName.trim()) ||
                    getAuthorName()

                transaction.set(
                    userDoc(currentUser.uid),
                    { lastPostAt: serverTimestamp() },
                    { merge: true }
                )
                transaction.set(postRef, {
                    content: normalizedDraft.content,
                    tickers: normalizedDraft.tickers,
                    tags: normalizedDraft.tags,
                    authorId: currentUser.uid,
                    authorName,
                    createdAt: serverTimestamp(),
                    editedAt: null,
                    likeCount: 0,
                    reportCount: 0,
                    ...(uploadedImage
                        ? {
                              imageUrl: uploadedImage.url,
                              imagePath: uploadedImage.path,
                              imageWidth: uploadedImage.width,
                              imageHeight: uploadedImage.height,
                          }
                        : buildEmptyImageFields()),
                })
            })
        } catch (error) {
            if (uploadedImage) {
                await safelyDeleteCommunityImage(uploadedImage.path)
            }

            logCommunityError('create firestore write failed', error, {
                postId,
                userId: currentUser.uid,
                hasImage: Boolean(uploadedImage),
            })
            throw new Error(
                getCommunityPublishErrorMessage(error, 'firestore-write')
            )
        }

        const createdPost = await this.getPost(postRef.id, currentUser.uid)

        if (!createdPost) {
            throw new Error('Failed to load the created post.')
        }

        return createdPost
    },

    async updatePost(postId: string, draft: CommunityPostDraft): Promise<CommunityPost> {
        const currentUser = ensureAuthenticatedUser()
        const normalizedDraft = validateDraft(draft)
        const currentSnapshot = await getDoc(postDoc(postId))

        if (!currentSnapshot.exists()) {
            throw new Error('Post not found.')
        }

        const currentRecord = currentSnapshot.data()
        let uploadedImage: UploadedCommunityImage | null = null
        let nextImageFields: Partial<CommunityImageFields> = {}
        let imageToDelete: string | null = null

        if (normalizedDraft.image?.file) {
            try {
                uploadedImage = await uploadCommunityImage({
                    userId: currentUser.uid,
                    postId,
                    file: normalizedDraft.image.file,
                })
            } catch (error) {
                logCommunityError('update image upload failed', error, {
                    postId,
                    userId: currentUser.uid,
                })
                throw new Error(
                    getCommunityPublishErrorMessage(error, 'image-upload')
                )
            }
            nextImageFields = {
                imageUrl: uploadedImage.url,
                imagePath: uploadedImage.path,
                imageWidth: uploadedImage.width,
                imageHeight: uploadedImage.height,
            }

            if (
                currentRecord.imagePath &&
                currentRecord.imagePath !== uploadedImage.path &&
                isManagedCommunityImagePath(currentRecord.imagePath, currentUser.uid)
            ) {
                imageToDelete = currentRecord.imagePath
            }
        } else if (normalizedDraft.image?.remove) {
            nextImageFields = buildEmptyImageFields()

            if (
                currentRecord.imagePath &&
                isManagedCommunityImagePath(currentRecord.imagePath, currentUser.uid)
            ) {
                imageToDelete = currentRecord.imagePath
            }
        }

        try {
            await updateDoc(postDoc(postId), {
                content: normalizedDraft.content,
                tickers: normalizedDraft.tickers,
                tags: normalizedDraft.tags,
                editedAt: serverTimestamp(),
                ...nextImageFields,
            })
        } catch (error) {
            if (uploadedImage) {
                await safelyDeleteCommunityImage(uploadedImage.path)
            }

            logCommunityError('update firestore write failed', error, {
                postId,
                userId: currentUser.uid,
                hasReplacementImage: Boolean(uploadedImage),
                removeImage: Boolean(normalizedDraft.image?.remove),
            })
            throw new Error(
                getCommunityPublishErrorMessage(error, 'firestore-write')
            )
        }

        if (imageToDelete) {
            try {
                await safelyDeleteCommunityImage(imageToDelete)
            } catch (error) {
                logCommunityError('update image cleanup failed', error, {
                    postId,
                    userId: currentUser.uid,
                    imagePath: imageToDelete,
                })
            }
        }

        const updatedPost = await this.getPost(postId, currentUser.uid)

        if (!updatedPost) {
            throw new Error('Failed to load the updated post.')
        }

        return updatedPost
    },

    async deletePost(postId: string): Promise<void> {
        const currentUser = ensureAuthenticatedUser()
        const snapshot = await getDoc(postDoc(postId))

        if (!snapshot.exists()) {
            return
        }

        const currentRecord = snapshot.data()

        await deleteDoc(postDoc(postId))

        if (
            currentRecord.imagePath &&
            currentRecord.authorId === currentUser.uid &&
            isManagedCommunityImagePath(currentRecord.imagePath, currentUser.uid)
        ) {
            await safelyDeleteCommunityImage(currentRecord.imagePath)
        }
    },

    async toggleLike(postId: string): Promise<ToggleLikeResult> {
        const currentUser = ensureAuthenticatedUser()

        return runTransaction(postDoc(postId).firestore, async (transaction) => {
            const likeRef = userLikeDoc(currentUser.uid, postId)
            const postRef = postDoc(postId)
            const [likeSnapshot, postSnapshot] = await Promise.all([
                transaction.get(likeRef),
                transaction.get(postRef),
            ])

            if (!postSnapshot.exists()) {
                throw new Error('Post not found.')
            }

            const nextLikeCount = likeSnapshot.exists()
                ? Math.max(postSnapshot.data().likeCount - 1, 0)
                : postSnapshot.data().likeCount + 1

            if (likeSnapshot.exists()) {
                transaction.delete(likeRef)
            } else {
                transaction.set(likeRef, { createdAt: serverTimestamp() })
            }

            transaction.update(postRef, { likeCount: nextLikeCount })

            return {
                liked: !likeSnapshot.exists(),
                likeCount: nextLikeCount,
            }
        })
    },

    async toggleSave(postId: string): Promise<ToggleSaveResult> {
        const currentUser = ensureAuthenticatedUser()

        return runTransaction(postDoc(postId).firestore, async (transaction) => {
            const saveRef = userSaveDoc(currentUser.uid, postId)
            const postRef = postDoc(postId)
            const [saveSnapshot, postSnapshot] = await Promise.all([
                transaction.get(saveRef),
                transaction.get(postRef),
            ])

            if (!postSnapshot.exists()) {
                throw new Error('Post not found.')
            }

            if (saveSnapshot.exists()) {
                transaction.delete(saveRef)
            } else {
                transaction.set(saveRef, { createdAt: serverTimestamp() })
            }

            return {
                saved: !saveSnapshot.exists(),
            }
        })
    },

    async reportPost(
        postId: string,
        reason: CommunityReportReason
    ): Promise<ReportPostResult> {
        const currentUser = ensureAuthenticatedUser()

        return runTransaction(postDoc(postId).firestore, async (transaction) => {
            const reportRef = postReportDoc(postId, currentUser.uid)
            const postRef = postDoc(postId)
            const [reportSnapshot, postSnapshot] = await Promise.all([
                transaction.get(reportRef),
                transaction.get(postRef),
            ])

            if (reportSnapshot.exists()) {
                throw new CommunityAlreadyReportedError()
            }

            if (!postSnapshot.exists()) {
                throw new Error('Post not found.')
            }

            const nextReportCount = postSnapshot.data().reportCount + 1

            transaction.set(reportRef, {
                reason,
                createdAt: serverTimestamp(),
            })
            transaction.update(postRef, {
                reportCount: nextReportCount,
            })

            return {
                reportCount: nextReportCount,
            }
        })
    },

    async getRelatedPosts(
        postId: string,
        tickers: string[],
        userId?: string | null
    ): Promise<CommunityRelatedGroup[]> {
        const normalizedTickers = tickers
            .map(normalizeTicker)
            .filter(Boolean)
            .filter((ticker, index, values) => values.indexOf(ticker) === index)
            .slice(0, COMMUNITY_MAX_TICKERS)

        const queryResults = await Promise.all(
            normalizedTickers.map(async (ticker) => {
                const snapshot = await getDocs(
                    query(
                        postsCollection(),
                        where('tickers', 'array-contains', ticker),
                        orderBy('createdAt', 'desc'),
                        limit(6)
                    )
                )

                return {
                    ticker,
                    snapshots: snapshot.docs
                        .filter((docSnapshot) => docSnapshot.id !== postId)
                        .slice(0, 5),
                }
            })
        )

        const uniqueIds = Array.from(
            new Set(
                queryResults.flatMap((result) =>
                    result.snapshots.map((snapshot) => snapshot.id)
                )
            )
        )
        const viewerFlags = await loadViewerFlags(uniqueIds, userId)

        return queryResults.map((result) => ({
            ticker: result.ticker,
            posts: result.snapshots.map((snapshot) =>
                mapPostRecord(snapshot.id, snapshot.data(), viewerFlags, userId)
            ),
        }))
    },
}

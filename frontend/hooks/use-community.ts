'use client'

import {
    type InfiniteData,
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
} from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'

import {
    COMMUNITY_CONTENT_MAX,
    COMMUNITY_IMAGE_ACCEPT,
    COMMUNITY_MAX_TAGS,
    COMMUNITY_MAX_TICKERS,
    normalizeCommunityDraft,
    normalizeTag,
    normalizeTicker,
    parseChipInput,
    validateCommunityImageFile,
} from '@/lib/community'
import {
    CommunityAlreadyReportedError,
    communityService,
} from '@/services/community.service'
import { useAuthStore } from '@/store/use-auth-store'
import type {
    CommunityFeedCursor,
    CommunityFeedFilter,
    CommunityFeedPage,
    CommunityPost,
    CommunityPostDraft,
    CommunityReportReason,
} from '@/types'

const COMMUNITY_FEED_QUERY_KEY = 'community-feed'
const COMMUNITY_POST_QUERY_KEY = 'community-post'
const COMMUNITY_RELATED_QUERY_KEY = 'community-related-posts'

interface UseCommunityFeedParams {
    filter: CommunityFeedFilter
    ticker?: string | null
}

interface UpdatePostVariables {
    postId: string
    draft: CommunityPostDraft
}

interface CommunityComposerErrors {
    content?: string
    tickers?: string
    tags?: string
    image?: string
}

type CommunityInfiniteData = InfiniteData<CommunityFeedPage, CommunityFeedCursor | undefined>

function updatePostCollection(
    posts: CommunityPost[],
    postId: string,
    updater: (post: CommunityPost) => CommunityPost
) {
    return posts.map((post) => (post.id === postId ? updater(post) : post))
}

function removePostCollection(posts: CommunityPost[], postId: string) {
    return posts.filter((post) => post.id !== postId)
}

function patchInfiniteFeedData(
    data: CommunityInfiniteData | undefined,
    postId: string,
    updater: (post: CommunityPost) => CommunityPost
) {
    if (!data) return data

    return {
        ...data,
        pages: data.pages.map((page) => ({
            ...page,
            items: updatePostCollection(page.items, postId, updater),
        })),
    }
}

function removeFromInfiniteFeedData(
    data: CommunityInfiniteData | undefined,
    postId: string
) {
    if (!data) return data

    return {
        ...data,
        pages: data.pages.map((page) => ({
            ...page,
            items: removePostCollection(page.items, postId),
        })),
    }
}

function patchRelatedGroups(
    groups: Array<{ ticker: string; posts: CommunityPost[] }> | undefined,
    postId: string,
    updater: (post: CommunityPost) => CommunityPost
) {
    if (!groups) return groups

    return groups.map((group) => ({
        ...group,
        posts: updatePostCollection(group.posts, postId, updater),
    }))
}

function removeFromRelatedGroups(
    groups: Array<{ ticker: string; posts: CommunityPost[] }> | undefined,
    postId: string
) {
    if (!groups) return groups

    return groups.map((group) => ({
        ...group,
        posts: removePostCollection(group.posts, postId),
    }))
}

function snapshotCommunityCache(queryClient: ReturnType<typeof useQueryClient>) {
    return {
        feed: queryClient.getQueriesData({ queryKey: [COMMUNITY_FEED_QUERY_KEY] }),
        posts: queryClient.getQueriesData({ queryKey: [COMMUNITY_POST_QUERY_KEY] }),
        related: queryClient.getQueriesData({
            queryKey: [COMMUNITY_RELATED_QUERY_KEY],
        }),
    }
}

function restoreCommunityCache(
    queryClient: ReturnType<typeof useQueryClient>,
    snapshot: ReturnType<typeof snapshotCommunityCache> | undefined
) {
    if (!snapshot) return

    snapshot.feed.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
    })
    snapshot.posts.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
    })
    snapshot.related.forEach(([queryKey, data]) => {
        queryClient.setQueryData(queryKey, data)
    })
}

function patchCommunityPostEverywhere(
    queryClient: ReturnType<typeof useQueryClient>,
    postId: string,
    updater: (post: CommunityPost) => CommunityPost
) {
    queryClient.setQueriesData(
        { queryKey: [COMMUNITY_FEED_QUERY_KEY] },
        (data: CommunityInfiniteData | undefined) =>
            patchInfiniteFeedData(data, postId, updater)
    )
    queryClient.setQueriesData(
        { queryKey: [COMMUNITY_POST_QUERY_KEY] },
        (data: CommunityPost | null | undefined) =>
            data?.id === postId ? updater(data) : data
    )
    queryClient.setQueriesData(
        { queryKey: [COMMUNITY_RELATED_QUERY_KEY] },
        (data: Array<{ ticker: string; posts: CommunityPost[] }> | undefined) =>
            patchRelatedGroups(data, postId, updater)
    )
}

function removeCommunityPostEverywhere(
    queryClient: ReturnType<typeof useQueryClient>,
    postId: string
) {
    queryClient.setQueriesData(
        { queryKey: [COMMUNITY_FEED_QUERY_KEY] },
        (data: CommunityInfiniteData | undefined) =>
            removeFromInfiniteFeedData(data, postId)
    )
    queryClient.setQueriesData(
        { queryKey: [COMMUNITY_POST_QUERY_KEY] },
        (data: CommunityPost | null | undefined) =>
            data?.id === postId ? null : data
    )
    queryClient.setQueriesData(
        { queryKey: [COMMUNITY_RELATED_QUERY_KEY] },
        (data: Array<{ ticker: string; posts: CommunityPost[] }> | undefined) =>
            removeFromRelatedGroups(data, postId)
    )
}

export function isCommunityAlreadyReportedError(error: unknown) {
    return error instanceof CommunityAlreadyReportedError
}

export function useCommunityFeed({ filter, ticker }: UseCommunityFeedParams) {
    const userId = useAuthStore((state) => state.user?.id ?? null)
    const enabled = filter === 'all' || Boolean(userId)

    const query = useInfiniteQuery({
        queryKey: [COMMUNITY_FEED_QUERY_KEY, userId ?? 'anon', filter, ticker ?? ''],
        initialPageParam: undefined as CommunityFeedCursor | undefined,
        queryFn: ({ pageParam }) =>
            communityService.getFeedPage({
                filter,
                ticker,
                cursor: pageParam,
                userId,
            }),
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        enabled,
        staleTime: 30 * 1000,
    })

    const posts = useMemo(
        () => query.data?.pages.flatMap((page) => page.items) ?? [],
        [query.data]
    )

    return {
        ...query,
        posts,
        hasMore: Boolean(query.hasNextPage),
        retryNow: query.refetch,
    }
}

export function useCommunityPost(postId: string) {
    const userId = useAuthStore((state) => state.user?.id ?? null)

    return useQuery({
        queryKey: [COMMUNITY_POST_QUERY_KEY, userId ?? 'anon', postId],
        queryFn: () => communityService.getPost(postId, userId),
        staleTime: 30 * 1000,
    })
}

export function useCommunityRelatedPosts(postId: string, tickers: string[]) {
    const userId = useAuthStore((state) => state.user?.id ?? null)
    const normalizedTickers = useMemo(
        () =>
            tickers
                .map(normalizeTicker)
                .filter(Boolean)
                .filter((ticker, index, values) => values.indexOf(ticker) === index)
                .slice(0, COMMUNITY_MAX_TICKERS),
        [tickers]
    )

    return useQuery({
        queryKey: [
            COMMUNITY_RELATED_QUERY_KEY,
            userId ?? 'anon',
            postId,
            normalizedTickers.join(','),
        ],
        queryFn: () =>
            communityService.getRelatedPosts(postId, normalizedTickers, userId),
        enabled: normalizedTickers.length > 0,
        staleTime: 30 * 1000,
    })
}

export function useCreateCommunityPost() {
    const queryClient = useQueryClient()
    const userId = useAuthStore((state) => state.user?.id ?? null)

    return useMutation({
        mutationFn: (draft: CommunityPostDraft) => communityService.createPost(draft),
        onSuccess: (post) => {
            queryClient.setQueryData(
                [COMMUNITY_POST_QUERY_KEY, userId ?? 'anon', post.id],
                post
            )
            void queryClient.invalidateQueries({
                queryKey: [COMMUNITY_FEED_QUERY_KEY],
            })
        },
    })
}

export function useUpdateCommunityPost() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({ postId, draft }: UpdatePostVariables) =>
            communityService.updatePost(postId, draft),
        onSuccess: (post) => {
            patchCommunityPostEverywhere(queryClient, post.id, () => post)
        },
    })
}

export function useDeleteCommunityPost() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (postId: string) => communityService.deletePost(postId),
        onSuccess: (_, postId) => {
            removeCommunityPostEverywhere(queryClient, postId)
        },
    })
}

export function useToggleCommunityLike() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (postId: string) => communityService.toggleLike(postId),
        onMutate: async (postId) => {
            await Promise.all([
                queryClient.cancelQueries({ queryKey: [COMMUNITY_FEED_QUERY_KEY] }),
                queryClient.cancelQueries({ queryKey: [COMMUNITY_POST_QUERY_KEY] }),
                queryClient.cancelQueries({
                    queryKey: [COMMUNITY_RELATED_QUERY_KEY],
                }),
            ])

            const snapshot = snapshotCommunityCache(queryClient)

            patchCommunityPostEverywhere(queryClient, postId, (post) => ({
                ...post,
                viewerHasLiked: !post.viewerHasLiked,
                likeCount: Math.max(
                    post.likeCount + (post.viewerHasLiked ? -1 : 1),
                    0
                ),
            }))

            return snapshot
        },
        onError: (_error, _postId, snapshot) => {
            restoreCommunityCache(queryClient, snapshot)
        },
        onSuccess: (result, postId) => {
            patchCommunityPostEverywhere(queryClient, postId, (post) => ({
                ...post,
                viewerHasLiked: result.liked,
                likeCount: result.likeCount,
            }))
        },
    })
}

export function useToggleCommunitySave() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: (postId: string) => communityService.toggleSave(postId),
        onMutate: async (postId) => {
            await Promise.all([
                queryClient.cancelQueries({ queryKey: [COMMUNITY_FEED_QUERY_KEY] }),
                queryClient.cancelQueries({ queryKey: [COMMUNITY_POST_QUERY_KEY] }),
                queryClient.cancelQueries({
                    queryKey: [COMMUNITY_RELATED_QUERY_KEY],
                }),
            ])

            const snapshot = snapshotCommunityCache(queryClient)

            patchCommunityPostEverywhere(queryClient, postId, (post) => ({
                ...post,
                viewerHasSaved: !post.viewerHasSaved,
            }))

            return snapshot
        },
        onError: (_error, _postId, snapshot) => {
            restoreCommunityCache(queryClient, snapshot)
        },
        onSuccess: (result, postId) => {
            patchCommunityPostEverywhere(queryClient, postId, (post) => ({
                ...post,
                viewerHasSaved: result.saved,
            }))
            void queryClient.invalidateQueries({
                queryKey: [COMMUNITY_FEED_QUERY_KEY],
            })
        },
    })
}

export function useReportCommunityPost() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: ({
            postId,
            reason,
        }: {
            postId: string
            reason: CommunityReportReason
        }) => communityService.reportPost(postId, reason),
        onSuccess: (result, variables) => {
            patchCommunityPostEverywhere(queryClient, variables.postId, (post) => ({
                ...post,
                reportCount: result.reportCount,
            }))
        },
    })
}

export function useCommunityComposer(initialDraft?: Partial<CommunityPostDraft>) {
    const initial = useMemo(
        () =>
            normalizeCommunityDraft({
                content: initialDraft?.content ?? '',
                tickers: initialDraft?.tickers ?? [],
                tags: initialDraft?.tags ?? [],
                image: initialDraft?.image
                    ? {
                          file: initialDraft.image.file ?? null,
                          existingUrl: initialDraft.image.existingUrl ?? null,
                          existingPath: initialDraft.image.existingPath ?? null,
                          existingWidth: initialDraft.image.existingWidth ?? null,
                          existingHeight: initialDraft.image.existingHeight ?? null,
                          remove: Boolean(initialDraft.image.remove),
                      }
                    : null,
            }),
        [initialDraft]
    )

    const [content, setContent] = useState(initial.content)
    const [tickers, setTickers] = useState(initial.tickers)
    const [tags, setTags] = useState(initial.tags)
    const [imageFile, setImageFile] = useState<File | null>(initial.image?.file ?? null)
    const [removeImage, setRemoveImage] = useState(Boolean(initial.image?.remove))
    const [imageError, setImageError] = useState<string | undefined>(undefined)
    const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null)

    useEffect(() => {
        if (!imageFile) {
            setImagePreviewUrl(null)
            return
        }

        const objectUrl = URL.createObjectURL(imageFile)
        setImagePreviewUrl(objectUrl)

        return () => {
            URL.revokeObjectURL(objectUrl)
        }
    }, [imageFile])

    const normalizedDraft = useMemo(
        () =>
            normalizeCommunityDraft({
                content,
                tickers,
                tags,
                image: {
                    file: imageFile,
                    existingUrl: initial.image?.existingUrl ?? null,
                    existingPath: initial.image?.existingPath ?? null,
                    existingWidth: initial.image?.existingWidth ?? null,
                    existingHeight: initial.image?.existingHeight ?? null,
                    remove: removeImage,
                },
            }),
        [content, imageFile, initial.image, removeImage, tags, tickers]
    )

    const errors = useMemo<CommunityComposerErrors>(() => {
        const nextErrors: CommunityComposerErrors = {}

        if (!normalizedDraft.content) {
            nextErrors.content = 'Write a post before publishing.'
        } else if (normalizedDraft.content.length > COMMUNITY_CONTENT_MAX) {
            nextErrors.content = `Post content must be ${COMMUNITY_CONTENT_MAX} characters or fewer.`
        }

        if (normalizedDraft.tickers.length > COMMUNITY_MAX_TICKERS) {
            nextErrors.tickers = `You can add up to ${COMMUNITY_MAX_TICKERS} tickers.`
        }

        if (normalizedDraft.tags.length > COMMUNITY_MAX_TAGS) {
            nextErrors.tags = `You can add up to ${COMMUNITY_MAX_TAGS} tags.`
        }

        if (imageError) {
            nextErrors.image = imageError
        }

        return nextErrors
    }, [imageError, normalizedDraft])

    const hasExistingImage = Boolean(initial.image?.existingUrl)
    const isDirty =
        initial.content !== normalizedDraft.content ||
        JSON.stringify(initial.tickers) !== JSON.stringify(normalizedDraft.tickers) ||
        JSON.stringify(initial.tags) !== JSON.stringify(normalizedDraft.tags) ||
        Boolean(imageFile) ||
        removeImage

    function addTickersFromInput(value: string) {
        const nextValues = parseChipInput(
            value,
            normalizeTicker,
            COMMUNITY_MAX_TICKERS
        )

        if (nextValues.length === 0) return

        setTickers((current) =>
            Array.from(new Set([...current, ...nextValues])).slice(
                0,
                COMMUNITY_MAX_TICKERS
            )
        )
    }

    function addTagsFromInput(value: string) {
        const nextValues = parseChipInput(value, normalizeTag, COMMUNITY_MAX_TAGS)

        if (nextValues.length === 0) return

        setTags((current) =>
            Array.from(new Set([...current, ...nextValues])).slice(
                0,
                COMMUNITY_MAX_TAGS
            )
        )
    }

    function attachImage(file: File) {
        const nextImageError = validateCommunityImageFile(file)

        if (nextImageError) {
            setImageError(nextImageError)
            return false
        }

        setImageFile(file)
        setRemoveImage(false)
        setImageError(undefined)
        return true
    }

    function clearImage() {
        setImageFile(null)
        setImageError(undefined)
        setRemoveImage(hasExistingImage)
    }

    function restoreExistingImage() {
        setImageFile(null)
        setImageError(undefined)
        setRemoveImage(false)
    }

    function reset() {
        setContent(initial.content)
        setTickers(initial.tickers)
        setTags(initial.tags)
        setImageFile(initial.image?.file ?? null)
        setImageError(undefined)
        setRemoveImage(Boolean(initial.image?.remove))
    }

    return {
        content,
        setContent,
        tickers,
        tags,
        addTickersFromInput,
        addTagsFromInput,
        removeTicker: (ticker: string) =>
            setTickers((current) => current.filter((item) => item !== ticker)),
        removeTag: (tag: string) =>
            setTags((current) => current.filter((item) => item !== tag)),
        normalizedDraft,
        remainingChars: COMMUNITY_CONTENT_MAX - content.length,
        errors,
        isDirty,
        submitDisabled: !isDirty || Object.keys(errors).length > 0,
        reset,
        imageInputAccept: COMMUNITY_IMAGE_ACCEPT,
        imagePreviewUrl,
        activeImageUrl:
            imagePreviewUrl ||
            (removeImage ? null : initial.image?.existingUrl ?? null),
        activeImageWidth:
            imagePreviewUrl || removeImage ? null : initial.image?.existingWidth ?? null,
        activeImageHeight:
            imagePreviewUrl || removeImage
                ? null
                : initial.image?.existingHeight ?? null,
        hasExistingImage,
        hasImage: Boolean(
            imagePreviewUrl || (!removeImage && initial.image?.existingUrl)
        ),
        canRestoreImage: hasExistingImage && removeImage && !imageFile,
        removeImageRequested: removeImage,
        attachImage,
        clearImage,
        restoreExistingImage,
    }
}

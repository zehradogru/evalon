'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ArrowRight, Bookmark, Compass, Plus, Sparkles } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

import { Button } from '@/components/ui/button'
import {
    isCommunityAlreadyReportedError,
    useCommunityFeed,
    useCreateCommunityPost,
    useDeleteCommunityPost,
    useReportCommunityPost,
    useToggleCommunityLike,
    useToggleCommunitySave,
    useUpdateCommunityPost,
} from '@/hooks/use-community'
import { useInfiniteLoad } from '@/hooks/use-infinite-load'
import { useToast } from '@/hooks/use-toast'
import { CommunityComposerPanel } from '@/features/community/components/community-composer-panel'
import { CommunityFeedList } from '@/features/community/components/community-feed-list'
import { CommunityFilterBar } from '@/features/community/components/community-filter-bar'
import { CommunityPostCard } from '@/features/community/components/community-post-card'
import { buildCommunityPostUrl, normalizeTicker } from '@/lib/community'
import { useAuthStore } from '@/store/use-auth-store'
import type { CommunityFeedFilter, CommunityPost, CommunityPostDraft, CommunityReportReason } from '@/types'

type ComposerState =
    | { mode: 'create' }
    | { mode: 'edit'; post: CommunityPost }
    | null

async function sharePost(post: CommunityPost, toast: ReturnType<typeof useToast>['toast']) {
    const shareUrl = new URL(buildCommunityPostUrl(post.id), window.location.origin).toString()

    try {
        if (typeof navigator.share === 'function') {
            await navigator.share({
                url: shareUrl,
                text: post.content,
            })
            return
        }

        await navigator.clipboard.writeText(shareUrl)
        toast({
            title: 'Link copied',
            description: 'The post link was copied to your clipboard.',
        })
    } catch {
        toast({
            title: 'Share failed',
            description: 'Unable to share this post right now.',
            variant: 'destructive',
        })
    }
}

function getInitialDraft(post?: CommunityPost): CommunityPostDraft | undefined {
    if (!post) return undefined

    return {
        content: post.content,
        tickers: post.tickers,
        tags: post.tags,
        image: {
            file: null,
            existingUrl: post.imageUrl,
            existingPath: post.imagePath,
            existingWidth: post.imageWidth,
            existingHeight: post.imageHeight,
            remove: false,
        },
    }
}

export function CommunityView() {
    const router = useRouter()
    const pathname = usePathname()
    const searchParams = useSearchParams()
    const { toast } = useToast()
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const [filter, setFilter] = useState<CommunityFeedFilter>('all')
    const [composerState, setComposerState] = useState<ComposerState>(null)

    const activeTicker = useMemo(() => {
        const rawTicker = searchParams.get('ticker')
        if (!rawTicker) return null
        const normalized = normalizeTicker(rawTicker)
        return normalized || null
    }, [searchParams])

    const feedQuery = useCommunityFeed({
        filter,
        ticker: activeTicker,
    })
    const createPostMutation = useCreateCommunityPost()
    const updatePostMutation = useUpdateCommunityPost()
    const deletePostMutation = useDeleteCommunityPost()
    const likeMutation = useToggleCommunityLike()
    const saveMutation = useToggleCommunitySave()
    const reportMutation = useReportCommunityPost()

    const { sentinelRef } = useInfiniteLoad({
        canLoadMore: Boolean(feedQuery.hasMore),
        isLoadingMore: feedQuery.isFetchingNextPage,
        onLoadMore: () => {
            void feedQuery.fetchNextPage()
        },
    })

    const requiresAuth = !isAuthenticated && (filter === 'saved' || filter === 'mine')

    const emptyVariant = requiresAuth
        ? 'auth-required'
        : feedQuery.isError
          ? 'error'
          : filter === 'saved'
            ? 'saved-empty'
            : filter === 'mine'
              ? 'mine-empty'
              : 'all-empty'

    function clearTickerFilter() {
        const nextParams = new URLSearchParams(searchParams.toString())
        nextParams.delete('ticker')
        const nextUrl = nextParams.toString()
            ? `${pathname}?${nextParams.toString()}`
            : pathname
        router.replace(nextUrl)
    }

    function requireAuth(message: string) {
        toast({
            title: 'Sign in required',
            description: message,
            variant: 'destructive',
        })
    }

    async function handleCreatePost(draft: CommunityPostDraft) {
        try {
            const post = await createPostMutation.mutateAsync(draft)
            setComposerState(null)
            toast({
                title: 'Post published',
                description: 'Your community post is now live.',
            })
            router.push(buildCommunityPostUrl(post.id))
        } catch (error) {
            toast({
                title: 'Unable to publish post',
                description:
                    error instanceof Error
                        ? error.message
                        : 'The post could not be published.',
                variant: 'destructive',
            })
        }
    }

    async function handleEditPost(postId: string, draft: CommunityPostDraft) {
        try {
            await updatePostMutation.mutateAsync({ postId, draft })
            setComposerState(null)
            toast({
                title: 'Post updated',
                description: 'Your changes have been saved.',
            })
        } catch (error) {
            toast({
                title: 'Unable to update post',
                description:
                    error instanceof Error
                        ? error.message
                        : 'The post could not be updated.',
                variant: 'destructive',
            })
        }
    }

    async function handleDeletePost(post: CommunityPost) {
        if (!window.confirm('Delete this post permanently?')) {
            return
        }

        try {
            await deletePostMutation.mutateAsync(post.id)
            setComposerState((current) =>
                current?.mode === 'edit' && current.post.id === post.id ? null : current
            )
            toast({
                title: 'Post deleted',
                description: 'The post was removed from the community feed.',
            })
        } catch (error) {
            toast({
                title: 'Unable to delete post',
                description:
                    error instanceof Error
                        ? error.message
                        : 'The post could not be deleted.',
                variant: 'destructive',
            })
        }
    }

    async function handleLike(post: CommunityPost) {
        if (!isAuthenticated) {
            requireAuth('Sign in to like community posts.')
            return
        }
        try {
            await likeMutation.mutateAsync(post.id)
        } catch (error) {
            toast({
                title: 'Unable to update like',
                description:
                    error instanceof Error
                        ? error.message
                        : 'The like action failed.',
                variant: 'destructive',
            })
        }
    }

    async function handleSave(post: CommunityPost) {
        if (!isAuthenticated) {
            requireAuth('Sign in to save community posts.')
            return
        }
        try {
            await saveMutation.mutateAsync(post.id)
        } catch (error) {
            toast({
                title: 'Unable to update save',
                description:
                    error instanceof Error
                        ? error.message
                        : 'The save action failed.',
                variant: 'destructive',
            })
        }
    }

    async function handleReport(post: CommunityPost, reason: CommunityReportReason) {
        if (!isAuthenticated) {
            requireAuth('Sign in to report community posts.')
            return
        }
        try {
            await reportMutation.mutateAsync({ postId: post.id, reason })
            toast({
                title: 'Report submitted',
                description: `The post was reported for ${reason.toLowerCase()}.`,
            })
        } catch (error) {
            toast({
                title: isCommunityAlreadyReportedError(error)
                    ? 'Already reported'
                    : 'Unable to report post',
                description:
                    error instanceof Error
                        ? error.message
                        : 'The report could not be submitted.',
                variant: 'destructive',
            })
        }
    }

    return (
        <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,rgba(40,98,255,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(36,166,147,0.16),transparent_24%)]" />

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 pb-24 sm:px-6">
                <section className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.01))] p-6 shadow-[0_36px_120px_-72px_rgba(0,0,0,0.95)]">
                    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(16rem,0.8fr)]">
                        <div className="space-y-5">
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.26em] text-primary">
                                <Sparkles className="size-3.5" />
                                Community editorial feed
                            </div>

                            <div className="space-y-3">
                                <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
                                    Leave a sharper trail than a comment thread.
                                </h1>
                                <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                                    Publish concise setups, screenshots, and conviction notes with enough structure to make the next read faster.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {isAuthenticated ? (
                                    <Button size="lg" onClick={() => setComposerState({ mode: 'create' })}>
                                        <Plus className="size-4" />
                                        Create post
                                    </Button>
                                ) : (
                                    <Button asChild size="lg">
                                        <Link href="/login">
                                            <Plus className="size-4" />
                                            Sign in to create
                                        </Link>
                                    </Button>
                                )}

                                <Button variant="outline" size="lg" onClick={() => setFilter('saved')}>
                                    <Bookmark className="size-4" />
                                    Review saved
                                </Button>

                                {activeTicker ? (
                                    <span className="rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-sm text-primary">
                                        Focus: ${activeTicker}
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                            <div className="rounded-[1.75rem] border border-white/10 bg-black/30 p-4">
                                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                                    Best format
                                </p>
                                <p className="mt-3 text-sm leading-6 text-foreground/90">
                                    One thesis, one visual anchor, and up to three symbols. Enough structure to scan, not enough to bury the point.
                                </p>
                            </div>
                            <div className="rounded-[1.75rem] border border-white/10 bg-black/30 p-4">
                                <p className="text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                                    Reader mode
                                </p>
                                <p className="mt-3 text-sm leading-6 text-foreground/90">
                                    Save what matters, filter by ticker, then revisit your own archive under <span className="font-semibold text-foreground">Mine</span>.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <CommunityFilterBar
                    filter={filter}
                    activeTicker={activeTicker}
                    onFilterChange={setFilter}
                    onClearTicker={clearTickerFilter}
                    requiresAuth={requiresAuth}
                />

                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <p className="text-xs font-medium uppercase tracking-[0.26em] text-muted-foreground">
                                Live feed
                            </p>
                            <h2 className="text-2xl font-semibold tracking-tight">
                                {filter === 'saved'
                                    ? 'Saved notes'
                                    : filter === 'mine'
                                      ? 'Your notes'
                                      : 'Latest notes'}
                            </h2>
                        </div>
                        <div className="hidden items-center gap-2 text-xs text-muted-foreground sm:flex">
                            <Compass className="size-4" />
                            Latest first. Ticker chips jump into filtered views.
                        </div>
                    </div>

                    <CommunityFeedList
                        posts={feedQuery.posts}
                        hasMore={Boolean(feedQuery.hasMore)}
                        isLoading={feedQuery.isLoading}
                        isFetchingMore={feedQuery.isFetchingNextPage}
                        sentinelRef={sentinelRef}
                        emptyVariant={emptyVariant}
                        onRetry={() => {
                            void feedQuery.retryNow()
                        }}
                        ticker={activeTicker}
                        requiresAuth={requiresAuth}
                        renderPost={(post) => (
                            <CommunityPostCard
                                key={post.id}
                                post={post}
                                context="feed"
                                onLike={handleLike}
                                onSave={handleSave}
                                onShare={(targetPost) => {
                                    void sharePost(targetPost, toast)
                                }}
                                onEdit={(targetPost) =>
                                    setComposerState({ mode: 'edit', post: targetPost })
                                }
                                onDelete={(targetPost) => {
                                    void handleDeletePost(targetPost)
                                }}
                                onReport={(targetPost, reason) => {
                                    void handleReport(targetPost, reason)
                                }}
                            />
                        )}
                    />
                </section>
            </div>

            {isAuthenticated ? (
                <Button
                    type="button"
                    size="icon-lg"
                    className="fixed right-5 bottom-5 z-30 rounded-full shadow-[0_24px_60px_-30px_rgba(40,98,255,0.9)] sm:hidden"
                    onClick={() => setComposerState({ mode: 'create' })}
                >
                    <Plus className="size-5" />
                    <span className="sr-only">Create post</span>
                </Button>
            ) : null}

            {composerState ? (
                <CommunityComposerPanel
                    key={
                        composerState.mode === 'create'
                            ? 'community-create'
                            : `community-edit-${composerState.post.id}`
                    }
                    open
                    mode={composerState.mode}
                    initialDraft={
                        composerState.mode === 'edit'
                            ? getInitialDraft(composerState.post)
                            : undefined
                    }
                    isSubmitting={
                        composerState.mode === 'create'
                            ? createPostMutation.isPending
                            : updatePostMutation.isPending
                    }
                    onOpenChange={(open) => {
                        if (!open) {
                            setComposerState(null)
                        }
                    }}
                    onSubmit={(draft) =>
                        composerState.mode === 'create'
                            ? handleCreatePost(draft)
                            : handleEditPost(composerState.post.id, draft)
                    }
                />
            ) : null}
        </div>
    )
}

'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { Bookmark, Compass, Flame, Plus, Sparkles, TrendingUp, Users } from 'lucide-react'
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
import { CommunityDiscussionPanel } from '@/features/community/components/community-discussion-panel'
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
    const [openDiscussionPostId, setOpenDiscussionPostId] = useState<string | null>(null)

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

    function toggleDiscussion(post: CommunityPost) {
        setOpenDiscussionPostId((current) => (current === post.id ? null : post.id))
    }

    return (
        <div className="relative overflow-hidden">
            {/* -------- Animated background mesh -------- */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[32rem] overflow-hidden">
                <div className="animate-aurora absolute -left-32 top-0 h-80 w-[40rem] rounded-full bg-[radial-gradient(ellipse,rgba(40,98,255,0.18),transparent_60%)] blur-3xl" />
                <div className="animate-aurora animation-delay-2000 absolute -right-20 top-12 h-72 w-[32rem] rounded-full bg-[radial-gradient(ellipse,rgba(36,166,147,0.14),transparent_60%)] blur-3xl" />
                <div className="animate-aurora animation-delay-4000 absolute left-1/3 top-20 h-60 w-[28rem] rounded-full bg-[radial-gradient(ellipse,rgba(124,58,237,0.1),transparent_60%)] blur-3xl" />
            </div>

            <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-6 pb-24 sm:px-6">

                {/* ===================== HERO SECTION ===================== */}
	                <section className="animate-fade-in-up relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.045] via-white/[0.018] to-transparent p-5 shadow-[0_24px_80px_-32px_rgba(0,0,0,0.7)] sm:p-6">
                    {/* Decorative grid pattern */}
                    <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

	                    <div className="relative grid gap-6 lg:grid-cols-[1fr_auto]">
	                        <div className="space-y-4">
                            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-primary">
                                <Sparkles className="size-3.5" />
                                Community
                            </div>

                            <div className="space-y-3">
	                                <h1 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-4xl">
                                    Share setups.{' '}
                                    <span className="bg-gradient-to-r from-primary via-blue-400 to-cyan-400 bg-clip-text text-transparent">
                                        Shape conviction.
                                    </span>
                                </h1>
	                                <p className="max-w-lg text-sm leading-7 text-muted-foreground">
                                    Publish concise market notes with charts, tickers, and your thesis — structured for fast scanning.
                                </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-3">
                                {isAuthenticated ? (
                                    <Button
                                        size="lg"
                                        className="animate-glow-ring rounded-xl shadow-[0_8px_32px_-8px_rgba(40,98,255,0.5)]"
                                        onClick={() => setComposerState({ mode: 'create' })}
                                    >
                                        <Plus className="size-4" />
                                        Create post
                                    </Button>
                                ) : (
                                    <Button asChild size="lg" className="rounded-xl shadow-[0_8px_32px_-8px_rgba(40,98,255,0.5)]">
                                        <Link href="/login">
                                            <Plus className="size-4" />
                                            Sign in to create
                                        </Link>
                                    </Button>
                                )}

                                <Button variant="outline" size="lg" className="rounded-xl" onClick={() => setFilter('saved')}>
                                    <Bookmark className="size-4" />
                                    Saved posts
                                </Button>

                                {activeTicker ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-sm font-medium text-primary">
                                        <TrendingUp className="size-3.5" />
                                        ${activeTicker}
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        {/* Stat cards */}
	                        <div className="hidden gap-3 lg:grid lg:grid-cols-1 lg:w-52">
                            <div className="group rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all duration-500 hover:border-white/[0.1] hover:bg-white/[0.05]">
                                <div className="mb-2.5 flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform duration-500 group-hover:scale-110">
                                    <Flame className="size-4" />
                                </div>
                                <p className="text-xs font-medium text-muted-foreground">Best format</p>
                                <p className="mt-1.5 text-[13px] leading-[1.6] text-foreground/80">
                                    One thesis, one chart, up to three tickers.
                                </p>
                            </div>
                            <div className="group rounded-xl border border-white/[0.06] bg-white/[0.03] p-4 transition-all duration-500 hover:border-white/[0.1] hover:bg-white/[0.05]">
                                <div className="mb-2.5 flex size-9 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400 transition-transform duration-500 group-hover:scale-110">
                                    <Users className="size-4" />
                                </div>
                                <p className="text-xs font-medium text-muted-foreground">Reader mode</p>
                                <p className="mt-1.5 text-[13px] leading-[1.6] text-foreground/80">
                                    Save, filter by ticker, revisit under <span className="font-semibold text-foreground">Mine</span>.
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* ===================== FILTER BAR ===================== */}
                <CommunityFilterBar
                    filter={filter}
                    activeTicker={activeTicker}
                    onFilterChange={setFilter}
                    onClearTicker={clearTickerFilter}
                    requiresAuth={requiresAuth}
                />

                {/* ===================== FEED ===================== */}
                <section className="space-y-4">
                    <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
                                {filter === 'saved'
                                    ? 'Saved notes'
                                    : filter === 'mine'
                                      ? 'Your notes'
                                      : 'Latest notes'}
                            </h2>
                        </div>
                        <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] text-muted-foreground sm:flex">
                            <Compass className="size-3.5" />
                            Latest first
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
	                            <div key={post.id} className="space-y-3">
	                                <CommunityPostCard
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
	                                    onDiscuss={toggleDiscussion}
	                                    isDiscussionOpen={openDiscussionPostId === post.id}
	                                />
	                                {openDiscussionPostId === post.id ? (
	                                    <div className="-mt-3 rounded-b-2xl border-x border-b border-white/[0.06] bg-gradient-to-b from-white/[0.03] to-transparent px-4 py-4 shadow-[0_18px_44px_-32px_rgba(0,0,0,0.8)]">
	                                        <CommunityDiscussionPanel
	                                            postId={post.id}
	                                            commentCount={post.commentCount}
	                                            variant="inline"
	                                        />
	                                    </div>
	                                ) : null}
	                            </div>
	                        )}
                    />
                </section>
            </div>

            {/* ===================== MOBILE FAB ===================== */}
            {isAuthenticated ? (
                <Button
                    type="button"
                    size="icon-lg"
                    className="fixed right-5 bottom-5 z-30 animate-glow-ring rounded-full shadow-[0_12px_40px_-8px_rgba(40,98,255,0.7)] sm:hidden"
                    onClick={() => setComposerState({ mode: 'create' })}
                >
                    <Plus className="size-5" />
                    <span className="sr-only">Create post</span>
                </Button>
            ) : null}

            {/* ===================== COMPOSER PANEL ===================== */}
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

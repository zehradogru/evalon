import type { ReactNode, RefObject } from 'react'

import {
    CommunityEmptyState,
    type CommunityEmptyStateVariant,
} from '@/features/community/components/community-empty-state'
import type { CommunityPost } from '@/types'

interface CommunityFeedListProps {
    posts: CommunityPost[]
    hasMore: boolean
    isLoading: boolean
    isFetchingMore: boolean
    sentinelRef: RefObject<HTMLDivElement | null>
    emptyVariant: CommunityEmptyStateVariant
    onRetry: () => void
    renderPost: (post: CommunityPost) => ReactNode
    ticker?: string | null
    requiresAuth?: boolean
}

function SkeletonCard({ delay }: { delay: string }) {
    return (
        <div
            className={`animate-fade-in-up overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] ${delay}`}
        >
            {/* Top accent line */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

            {/* Header skeleton */}
            <div className="flex items-center gap-3 p-5 pb-0">
                <div className="size-10 animate-pulse rounded-full bg-white/[0.06]" />
                <div className="space-y-2">
                    <div className="h-3.5 w-28 rounded-md bg-white/[0.06]">
                        <div className="animate-shimmer h-full w-full rounded-md" />
                    </div>
                    <div className="h-2.5 w-20 rounded-md bg-white/[0.06]">
                        <div className="animate-shimmer h-full w-full rounded-md" />
                    </div>
                </div>
            </div>

            {/* Image skeleton */}
            <div className="mx-5 mt-4 overflow-hidden rounded-2xl">
                <div className="relative h-48 bg-white/[0.04]">
                    <div className="animate-shimmer h-full w-full" />
                </div>
            </div>

            {/* Text skeleton */}
            <div className="space-y-2.5 p-5">
                <div className="h-3.5 w-full rounded-md bg-white/[0.06]">
                    <div className="animate-shimmer h-full w-full rounded-md" />
                </div>
                <div className="h-3.5 w-4/5 rounded-md bg-white/[0.06]">
                    <div className="animate-shimmer h-full w-full rounded-md" />
                </div>
                <div className="h-3.5 w-3/5 rounded-md bg-white/[0.06]">
                    <div className="animate-shimmer h-full w-full rounded-md" />
                </div>
            </div>

            {/* Tags skeleton */}
            <div className="flex gap-2 px-5 pb-4">
                <div className="h-6 w-16 rounded-lg bg-white/[0.06]" />
                <div className="h-6 w-20 rounded-lg bg-white/[0.06]" />
            </div>

            {/* Action bar skeleton */}
            <div className="flex gap-2 border-t border-white/[0.06] px-3 py-3">
                <div className="h-7 w-16 rounded-xl bg-white/[0.04]" />
                <div className="h-7 w-16 rounded-xl bg-white/[0.04]" />
                <div className="h-7 w-16 rounded-xl bg-white/[0.04]" />
            </div>
        </div>
    )
}

export function CommunityFeedList({
    posts,
    hasMore,
    isLoading,
    isFetchingMore,
    sentinelRef,
    emptyVariant,
    onRetry,
    renderPost,
    ticker,
    requiresAuth = false,
}: CommunityFeedListProps) {
    if (isLoading) {
        return (
            <div className="space-y-5">
                <SkeletonCard delay="animation-delay-100" />
                <SkeletonCard delay="animation-delay-200" />
                <SkeletonCard delay="animation-delay-300" />
            </div>
        )
    }

    if (posts.length === 0) {
        return (
            <CommunityEmptyState
                variant={emptyVariant}
                ticker={ticker}
                requiresAuth={requiresAuth}
                onRetry={onRetry}
            />
        )
    }

    return (
        <div className="space-y-5">
            {posts.map((post, index) => (
                <div
                    key={post.id}
                    className="animate-fade-in-up"
                    style={{ animationDelay: `${Math.min(index * 80, 400)}ms` }}
                >
                    {renderPost(post)}
                </div>
            ))}
            {hasMore ? <div ref={sentinelRef} className="h-6 w-full" /> : null}
            {isFetchingMore ? (
                <div className="flex items-center justify-center gap-3 py-4">
                    <div className="size-5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />
                    <p className="text-sm text-muted-foreground">
                        Loading more notes...
                    </p>
                </div>
            ) : null}
        </div>
    )
}

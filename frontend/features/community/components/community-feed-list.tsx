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
            <div className="space-y-6">
                {Array.from({ length: 3 }).map((_, index) => (
                    <div
                        key={index}
                        className="overflow-hidden rounded-[2rem] border border-white/10 bg-card/40"
                    >
                        <div className="h-52 animate-pulse bg-white/[0.05]" />
                        <div className="space-y-4 p-5">
                            <div className="h-4 w-40 animate-pulse rounded-full bg-white/[0.06]" />
                            <div className="h-4 w-full animate-pulse rounded-full bg-white/[0.06]" />
                            <div className="h-4 w-3/4 animate-pulse rounded-full bg-white/[0.06]" />
                        </div>
                    </div>
                ))}
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
        <div className="space-y-6">
            {posts.map((post) => renderPost(post))}
            {hasMore ? <div ref={sentinelRef} className="h-6 w-full" /> : null}
            {isFetchingMore ? (
                <p className="text-center text-sm text-muted-foreground">
                    Loading more community notes...
                </p>
            ) : null}
        </div>
    )
}

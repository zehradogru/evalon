import { TrendingUp } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { CommunityPostCard } from '@/features/community/components/community-post-card'
import type {
    CommunityPost,
    CommunityRelatedGroup,
    CommunityReportReason,
} from '@/types'

interface CommunityRelatedPostGroupsProps {
    groups: CommunityRelatedGroup[]
    isLoading: boolean
    onLike: (post: CommunityPost) => void
    onSave: (post: CommunityPost) => void
    onShare: (post: CommunityPost) => void
    onEdit: (post: CommunityPost) => void
    onDelete: (post: CommunityPost) => void
    onReport: (post: CommunityPost, reason: CommunityReportReason) => void
}

export function CommunityRelatedPostGroups({
    groups,
    isLoading,
    onLike,
    onSave,
    onShare,
    onEdit,
    onDelete,
    onReport,
}: CommunityRelatedPostGroupsProps) {
    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <div className="animate-shimmer h-full w-full rounded-2xl" />
                </div>
                <div className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                    <div className="animate-shimmer h-full w-full rounded-2xl" />
                </div>
            </div>
        )
    }

    if (groups.length === 0 || groups.every((group) => group.posts.length === 0)) {
        return null
    }

    return (
        <div className="space-y-8">
            {groups
                .filter((group) => group.posts.length > 0)
                .map((group) => (
                    <section key={group.ticker} className="space-y-4">
                        {/* Section header with ticker badge */}
                        <div className="flex items-center gap-3">
                            {/* Divider line */}
                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

                            <Badge className="gap-1.5 rounded-lg border-0 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                                <TrendingUp className="size-3.5" />
                                ${group.ticker}
                            </Badge>

                            <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />
                        </div>

                        <div className="space-y-2">
                            <h2 className="text-xl font-bold tracking-tight">
                                Related notes
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                Recent context from traders discussing ${group.ticker}.
                            </p>
                        </div>

                        <div className="space-y-4">
                            {group.posts.map((post, index) => (
                                <div
                                    key={post.id}
                                    className="animate-fade-in-up"
                                    style={{ animationDelay: `${index * 100}ms` }}
                                >
                                    <CommunityPostCard
                                        post={post}
                                        context="related"
                                        onLike={onLike}
                                        onSave={onSave}
                                        onShare={onShare}
                                        onEdit={onEdit}
                                        onDelete={onDelete}
                                        onReport={onReport}
                                    />
                                </div>
                            ))}
                        </div>
                    </section>
                ))}
        </div>
    )
}

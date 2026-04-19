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
                <div className="h-28 animate-pulse rounded-[2rem] border border-white/10 bg-card/40" />
                <div className="h-28 animate-pulse rounded-[2rem] border border-white/10 bg-card/40" />
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
                        <div className="space-y-2">
                            <p className="text-xs font-medium uppercase tracking-[0.28em] text-muted-foreground">
                                Related flow
                            </p>
                            <h2 className="text-2xl font-semibold tracking-tight">
                                Other posts mentioning ${group.ticker}
                            </h2>
                            <p className="text-sm text-muted-foreground">
                                The latest nearby context from traders talking about the same symbol.
                            </p>
                        </div>
                        <div className="space-y-4">
                            {group.posts.map((post) => (
                                <CommunityPostCard
                                    key={post.id}
                                    post={post}
                                    context="related"
                                    onLike={onLike}
                                    onSave={onSave}
                                    onShare={onShare}
                                    onEdit={onEdit}
                                    onDelete={onDelete}
                                    onReport={onReport}
                                />
                            ))}
                        </div>
                    </section>
                ))}
        </div>
    )
}

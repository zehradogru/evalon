'use client'

import Link from 'next/link'
import {
    Bookmark,
    Flag,
    Heart,
    MoreHorizontal,
    Pencil,
    Share2,
    Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
    buildCommunityPostUrl,
    COMMUNITY_REPORT_REASONS,
    formatCommunityTimestamp,
} from '@/lib/community'
import { cn } from '@/lib/utils'
import type { CommunityPost, CommunityReportReason } from '@/types'

interface CommunityPostCardProps {
    post: CommunityPost
    context: 'feed' | 'detail' | 'related'
    onLike: (post: CommunityPost) => void
    onSave: (post: CommunityPost) => void
    onShare: (post: CommunityPost) => void
    onEdit?: (post: CommunityPost) => void
    onDelete?: (post: CommunityPost) => void
    onReport?: (post: CommunityPost, reason: CommunityReportReason) => void
}

function renderMedia(
    post: CommunityPost,
    context: CommunityPostCardProps['context'],
    postHref: string
) {
    if (!post.imageUrl) return null

    const imageMarkup = (
        <div
            className={cn(
                'overflow-hidden border border-white/10 bg-black',
                context === 'detail'
                    ? 'rounded-[2rem]'
                    : context === 'related'
                      ? 'rounded-[1.5rem]'
                      : 'rounded-[1.75rem]'
            )}
        >
            {/* Community media comes from Firebase-managed public URLs and should render without image optimizer coupling. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={post.imageUrl}
                alt={`Visual for ${post.authorName}'s post`}
                className={cn(
                    'w-full object-cover transition-transform duration-500',
                    context === 'detail'
                        ? 'max-h-[38rem]'
                        : context === 'related'
                          ? 'aspect-[16/9] hover:scale-[1.02]'
                          : 'aspect-[16/10] hover:scale-[1.015]'
                )}
            />
        </div>
    )

    if (context === 'detail') {
        return imageMarkup
    }

    return (
        <Link href={postHref} className="block">
            {imageMarkup}
        </Link>
    )
}

export function CommunityPostCard({
    post,
    context,
    onLike,
    onSave,
    onShare,
    onEdit,
    onDelete,
    onReport,
}: CommunityPostCardProps) {
    const isDetail = context === 'detail'
    const postHref = buildCommunityPostUrl(post.id)

    return (
        <Card className="gap-5 rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] p-5 shadow-[0_28px_80px_-52px_rgba(0,0,0,0.9)]">
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0 space-y-3">
                    <div className="flex items-center gap-3">
                        <div className="flex size-11 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-sm font-semibold text-primary shadow-[0_0_0_6px_rgba(40,98,255,0.08)]">
                            {post.authorName.slice(0, 1).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                                {post.authorName}
                            </p>
                            <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                                {formatCommunityTimestamp(post.createdAt)}
                                {post.editedAt ? ' · edited' : ''}
                            </p>
                        </div>
                    </div>
                    {context !== 'related' ? (
                        <p className="text-xs uppercase tracking-[0.28em] text-primary/80">
                            Market note
                        </p>
                    ) : null}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon-sm" className="rounded-full">
                            <MoreHorizontal />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        {post.isMine ? (
                            <>
                                <DropdownMenuItem onClick={() => onEdit?.(post)}>
                                    <Pencil />
                                    Edit
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => onDelete?.(post)}>
                                    <Trash2 />
                                    Delete
                                </DropdownMenuItem>
                            </>
                        ) : (
                            <DropdownMenuSub>
                                <DropdownMenuSubTrigger>
                                    <Flag />
                                    Report
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent>
                                    {COMMUNITY_REPORT_REASONS.map((reason) => (
                                        <DropdownMenuItem
                                            key={reason}
                                            onClick={() => onReport?.(post, reason)}
                                        >
                                            {reason}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onShare(post)}>
                            <Share2 />
                            Share
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {renderMedia(post, context, postHref)}

            {isDetail ? (
                <div className="whitespace-pre-wrap text-[15px] leading-8 text-foreground/92">
                    {post.content}
                </div>
            ) : (
                <Link
                    href={postHref}
                    className={cn(
                        'whitespace-pre-wrap text-[15px] leading-8 text-foreground/90 transition-colors hover:text-foreground',
                        context === 'related' && 'line-clamp-3 leading-7'
                    )}
                >
                    {post.content}
                </Link>
            )}

            {post.tickers.length > 0 || post.tags.length > 0 ? (
                <div className="flex flex-wrap items-center gap-2">
                    {post.tickers.map((ticker) => (
                        <Badge
                            key={ticker}
                            className="rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary"
                        >
                            <Link href={`/community?ticker=${encodeURIComponent(ticker)}`}>
                                ${ticker}
                            </Link>
                        </Badge>
                    ))}
                    {post.tags.map((tag) => (
                        <Badge
                            key={tag}
                            variant="outline"
                            className="rounded-full px-3 py-1"
                        >
                            #{tag}
                        </Badge>
                    ))}
                </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'rounded-full px-3',
                        post.viewerHasLiked && 'text-rose-500 hover:text-rose-500'
                    )}
                    onClick={() => onLike(post)}
                >
                    <Heart fill={post.viewerHasLiked ? 'currentColor' : 'none'} />
                    {post.likeCount}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'rounded-full px-3',
                        post.viewerHasSaved && 'text-amber-500 hover:text-amber-500'
                    )}
                    onClick={() => onSave(post)}
                >
                    <Bookmark fill={post.viewerHasSaved ? 'currentColor' : 'none'} />
                    {post.viewerHasSaved ? 'Saved' : 'Save'}
                </Button>
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="rounded-full px-3"
                    onClick={() => onShare(post)}
                >
                    <Share2 />
                    Share
                </Button>
            </div>
        </Card>
    )
}

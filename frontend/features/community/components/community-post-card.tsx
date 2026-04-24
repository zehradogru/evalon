'use client'

import Link from 'next/link'
import { useRef, useState } from 'react'
import {
    Bookmark,
    Flag,
    Heart,
    MessageCircle,
    MoreHorizontal,
    Pencil,
    Share2,
    Trash2,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { CommunityAvatar } from '@/features/community/components/community-avatar'
import { CommunityImageLightbox } from '@/features/community/components/community-image-lightbox'
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
    onDiscuss?: (post: CommunityPost) => void
    isDiscussionOpen?: boolean
}

function renderMedia(
    post: CommunityPost,
    context: CommunityPostCardProps['context'],
    onOpenImage: () => void
) {
    if (!post.imageUrl) return null

    return (
        <button
            type="button"
            onClick={onOpenImage}
            className={cn(
                'group/media relative block w-full overflow-hidden border border-white/[0.06] bg-black text-left',
                context === 'detail'
                    ? 'rounded-2xl'
                    : context === 'related'
                      ? 'rounded-xl'
                      : 'rounded-2xl'
            )}
        >
            {/* Community media comes from Firebase-managed public URLs and should render without image optimizer coupling. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={post.imageUrl}
                alt={`Visual for ${post.authorName}'s post`}
                className={cn(
                    'w-full object-cover transition-all duration-700 ease-out',
                    context === 'detail'
                        ? 'max-h-[38rem]'
                        : context === 'related'
                          ? 'aspect-[16/9] group-hover/media:scale-[1.04]'
                          : 'aspect-[16/10] group-hover/media:scale-[1.03]'
                )}
            />
            {/* Hover gradient overlay */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition-all duration-300 group-hover/media:bg-black/30 group-hover/media:opacity-100">
                <span className="rounded-full border border-white/15 bg-black/60 px-3 py-1.5 text-xs font-medium text-white shadow-lg">
                    Click to zoom
                </span>
            </div>
            {context !== 'detail' && (
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover/media:opacity-100" />
            )}
        </button>
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
    onDiscuss,
    isDiscussionOpen = false,
}: CommunityPostCardProps) {
    const isDetail = context === 'detail'
    const postHref = buildCommunityPostUrl(post.id)
    const [likeAnimating, setLikeAnimating] = useState(false)
    const [saveAnimating, setSaveAnimating] = useState(false)
    const [isImageOpen, setIsImageOpen] = useState(false)
    const likeTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)
    const saveTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null)

    function handleLikeClick() {
        onLike(post)
        setLikeAnimating(true)
        if (likeTimeoutRef.current) clearTimeout(likeTimeoutRef.current)
        likeTimeoutRef.current = setTimeout(() => setLikeAnimating(false), 450)
    }

    function handleSaveClick() {
        onSave(post)
        setSaveAnimating(true)
        if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
        saveTimeoutRef.current = setTimeout(() => setSaveAnimating(false), 450)
    }

    return (
        <Card
            className={cn(
                'group/card relative gap-0 overflow-hidden rounded-2xl border-white/[0.06] p-0 shadow-[0_2px_24px_-8px_rgba(0,0,0,0.6)] transition-all duration-500 ease-out',
                'bg-gradient-to-b from-white/[0.04] to-white/[0.01]',
                context !== 'detail' && 'hover:-translate-y-1 hover:border-white/[0.1] hover:shadow-[0_20px_60px_-20px_rgba(40,98,255,0.15)]'
            )}
        >
            {/* Subtle top accent line */}
            <div className="h-px w-full bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

            <div className="space-y-4 p-5">
                {/* Author header */}
                <div className="flex items-start justify-between gap-4">
	                    <div className="flex items-center gap-3">
	                        <CommunityAvatar name={post.authorName} showStatus />

                        <div className="min-w-0">
                            <p className="truncate text-sm font-semibold tracking-tight text-foreground">
                                {post.authorName}
                            </p>
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                <span>{formatCommunityTimestamp(post.createdAt)}</span>
                                {post.editedAt ? (
                                    <>
                                        <span className="text-muted-foreground/50">·</span>
                                        <span className="italic text-muted-foreground/70">edited</span>
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>

                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-sm"
                                className="rounded-full opacity-0 transition-opacity duration-300 group-hover/card:opacity-100 data-[state=open]:opacity-100"
                            >
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

                {/* Media */}
	                {renderMedia(post, context, () => setIsImageOpen(true))}

                {/* Content */}
                {isDetail ? (
                    <div className="whitespace-pre-wrap text-[15px] leading-[1.85] text-foreground/90">
                        {post.content}
                    </div>
                ) : (
                    <Link
                        href={postHref}
                        className={cn(
                            'block whitespace-pre-wrap text-[15px] leading-[1.8] text-foreground/85 transition-colors duration-300 hover:text-foreground',
                            context === 'related' && 'line-clamp-3 text-sm leading-7'
                        )}
                    >
                        {post.content}
                    </Link>
                )}

                {/* Tags & Tickers */}
                {post.tickers.length > 0 || post.tags.length > 0 ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                        {post.tickers.map((ticker) => (
                            <Link
                                key={ticker}
                                href={`/community?ticker=${encodeURIComponent(ticker)}`}
                            >
                                <Badge
                                    className="cursor-pointer rounded-lg border-0 bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-all duration-300 hover:bg-primary/20 hover:shadow-[0_0_12px_rgba(40,98,255,0.25)]"
                                >
                                    ${ticker}
                                </Badge>
                            </Link>
                        ))}
                        {post.tags.map((tag) => (
                            <Badge
                                key={tag}
                                variant="outline"
                                className="rounded-lg border-white/[0.08] bg-white/[0.03] px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors duration-300 hover:border-white/[0.15] hover:text-foreground"
                            >
                                #{tag}
                            </Badge>
                        ))}
                    </div>
                ) : null}
            </div>

            {/* Action bar */}
            <div className="flex items-center gap-1 border-t border-white/[0.06] px-3 py-2">
                {/* Like */}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'gap-1.5 rounded-xl px-3 text-xs transition-all duration-300',
                        post.viewerHasLiked
                            ? 'text-rose-400 hover:text-rose-400 hover:bg-rose-500/10'
                            : 'text-muted-foreground hover:text-rose-400 hover:bg-rose-500/10'
                    )}
                    onClick={handleLikeClick}
                >
                    <Heart
                        className={cn(
                            'size-4 transition-transform',
                            likeAnimating && 'animate-like-bounce'
                        )}
                        fill={post.viewerHasLiked ? 'currentColor' : 'none'}
                    />
                    <span className="tabular-nums">{post.likeCount}</span>
                </Button>

                {onDiscuss ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className={cn(
                            'gap-1.5 rounded-xl px-3 text-xs transition-colors',
                            isDiscussionOpen
                                ? 'bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary'
                                : 'text-muted-foreground'
                        )}
                        onClick={() => onDiscuss(post)}
                    >
                        <MessageCircle className="size-4" />
                        <span className="tabular-nums">{post.commentCount}</span>
                        <span className="hidden sm:inline">Discuss</span>
                    </Button>
                ) : (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="gap-1.5 rounded-xl px-3 text-xs text-muted-foreground"
                        asChild
                    >
                        <Link href={`${postHref}#comments`}>
                            <MessageCircle className="size-4" />
                            <span className="tabular-nums">{post.commentCount}</span>
                            <span className="hidden sm:inline">Discuss</span>
                        </Link>
                    </Button>
                )}

                {/* Save */}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className={cn(
                        'gap-1.5 rounded-xl px-3 text-xs transition-all duration-300',
                        post.viewerHasSaved
                            ? 'text-amber-400 hover:text-amber-400 hover:bg-amber-500/10'
                            : 'text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10'
                    )}
                    onClick={handleSaveClick}
                >
                    <Bookmark
                        className={cn(
                            'size-4 transition-transform',
                            saveAnimating && 'animate-like-bounce'
                        )}
                        fill={post.viewerHasSaved ? 'currentColor' : 'none'}
                    />
                    <span className="hidden sm:inline">{post.viewerHasSaved ? 'Saved' : 'Save'}</span>
                </Button>

                {/* Share — pushed right */}
                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="ml-auto gap-1.5 rounded-xl px-3 text-xs text-muted-foreground transition-all duration-300 hover:text-foreground"
                    onClick={() => onShare(post)}
                >
                    <Share2 className="size-4" />
                    <span className="hidden sm:inline">Share</span>
                </Button>
            </div>
            {post.imageUrl ? (
                <CommunityImageLightbox
                    imageUrl={post.imageUrl}
                    alt={`Visual for ${post.authorName}'s post`}
                    open={isImageOpen}
                    onOpenChange={setIsImageOpen}
                />
            ) : null}
        </Card>
    )
}

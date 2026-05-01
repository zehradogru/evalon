'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronRight, PenSquare } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import {
    isCommunityAlreadyReportedError,
    useCommunityPost,
    useCommunityRelatedPosts,
    useDeleteCommunityPost,
    useReportCommunityPost,
    useToggleCommunityLike,
    useToggleCommunitySave,
    useUpdateCommunityPost,
} from '@/hooks/use-community'
import { useToast } from '@/hooks/use-toast'
import { CommunityComposerPanel } from '@/features/community/components/community-composer-panel'
import { CommunityDiscussionPanel } from '@/features/community/components/community-discussion-panel'
import { CommunityEmptyState } from '@/features/community/components/community-empty-state'
import { CommunityPostCard } from '@/features/community/components/community-post-card'
import { CommunityRelatedPostGroups } from '@/features/community/components/community-related-post-groups'
import { buildCommunityPostUrl } from '@/lib/community'
import { useAuthStore } from '@/store/use-auth-store'
import type {
    CommunityPost,
    CommunityPostDraft,
    CommunityReportReason,
} from '@/types'

interface PostDetailViewProps {
    postId: string
}

function getInitialDraft(post: CommunityPost): CommunityPostDraft {
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

export function PostDetailView({ postId }: PostDetailViewProps) {
    const router = useRouter()
    const { toast } = useToast()
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const [isEditing, setIsEditing] = useState(false)

    const postQuery = useCommunityPost(postId)
    const relatedQuery = useCommunityRelatedPosts(postId, postQuery.data?.tickers ?? [])
    const updatePostMutation = useUpdateCommunityPost()
    const deletePostMutation = useDeleteCommunityPost()
    const likeMutation = useToggleCommunityLike()
    const saveMutation = useToggleCommunitySave()
    const reportMutation = useReportCommunityPost()

    function requireAuth(message: string) {
        toast({
            title: 'Sign in required',
            description: message,
            variant: 'destructive',
        })
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

    async function handleEdit(
        draft: CommunityPostDraft,
        currentPost: CommunityPost
    ) {
        try {
            await updatePostMutation.mutateAsync({
                postId: currentPost.id,
                draft,
            })
            setIsEditing(false)
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

    async function handleDelete(post: CommunityPost) {
        if (!window.confirm('Delete this post permanently?')) {
            return
        }

        try {
            await deletePostMutation.mutateAsync(post.id)
            setIsEditing(false)
            toast({
                title: 'Post deleted',
                description: 'The post was removed from the community feed.',
            })
            if (post.id === postId) {
                router.push('/community')
            }
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

    /* ---------- Loading skeleton ---------- */
    if (postQuery.isLoading) {
        return (
            <div className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
                {/* Breadcrumb skeleton */}
                <div className="h-8 w-40 animate-pulse rounded-xl bg-white/[0.04]" />

                {/* Card skeleton */}
                <div className="overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01]">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                    <div className="flex items-center gap-3 p-5">
                        <div className="size-10 animate-pulse rounded-full bg-white/[0.06]" />
                        <div className="space-y-2">
                            <div className="h-3.5 w-28 rounded-md bg-white/[0.06]"><div className="animate-shimmer h-full w-full rounded-md" /></div>
                            <div className="h-2.5 w-20 rounded-md bg-white/[0.06]"><div className="animate-shimmer h-full w-full rounded-md" /></div>
                        </div>
                    </div>
                    <div className="mx-5 h-64 rounded-xl bg-white/[0.04]"><div className="animate-shimmer h-full w-full" /></div>
                    <div className="space-y-2.5 p-5">
                        <div className="h-4 w-full rounded-md bg-white/[0.06]"><div className="animate-shimmer h-full w-full rounded-md" /></div>
                        <div className="h-4 w-3/4 rounded-md bg-white/[0.06]"><div className="animate-shimmer h-full w-full rounded-md" /></div>
                    </div>
                </div>
            </div>
        )
    }

    if (!postQuery.data) {
        return (
            <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
                <CommunityEmptyState variant="post-not-found" />
            </div>
        )
    }

    const currentPost = postQuery.data

    return (
        <div className="relative shrink-0 overflow-x-hidden">
            {/* Animated background mesh */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[28rem] overflow-hidden">
                <div className="animate-aurora absolute -left-32 top-0 h-72 w-[36rem] rounded-full bg-[radial-gradient(ellipse,rgba(40,98,255,0.15),transparent_60%)] blur-3xl" />
                <div className="animate-aurora animation-delay-2000 absolute -right-20 top-8 h-60 w-[28rem] rounded-full bg-[radial-gradient(ellipse,rgba(36,166,147,0.12),transparent_60%)] blur-3xl" />
            </div>

            <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 pb-24 sm:px-6">

                {/* Breadcrumb navigation */}
                <nav className="animate-fade-in-up flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Button asChild variant="ghost" size="sm" className="-ml-2 gap-1.5 rounded-xl text-muted-foreground hover:text-foreground">
                        <Link href="/community">
                            <ArrowLeft className="size-4" />
                            Community
                        </Link>
                    </Button>
                    <ChevronRight className="size-3.5 text-muted-foreground/50" />
                    <span className="truncate text-foreground/70">
                        {currentPost.authorName}&apos;s note
                    </span>
                </nav>

                {currentPost.isMine ? (
                    <div className="animate-fade-in-up animation-delay-100 flex justify-end">
                        <Button
                            size="sm"
                            className="w-fit rounded-xl shadow-[0_4px_16px_-4px_rgba(40,98,255,0.5)]"
                            onClick={() => setIsEditing(true)}
                        >
                            <PenSquare className="size-4" />
                            Edit post
                        </Button>
                    </div>
                ) : null}

                {/* Main post */}
                <div className="animate-fade-in-up animation-delay-200">
                    <CommunityPostCard
                        post={currentPost}
                        context="detail"
                        onLike={handleLike}
                        onSave={handleSave}
                        onShare={(post) => {
                            void sharePost(post, toast)
                        }}
                        onEdit={() => setIsEditing(true)}
                        onDelete={(post) => {
                            void handleDelete(post)
                        }}
                        onReport={(post, reason) => {
                            void handleReport(post, reason)
                        }}
                    />
                </div>

                <div className="animate-fade-in-up animation-delay-300">
                    <CommunityDiscussionPanel
                        postId={currentPost.id}
                        commentCount={currentPost.commentCount}
                    />
                </div>

                {/* Related posts */}
                <div className="animate-fade-in-up animation-delay-300">
                    <CommunityRelatedPostGroups
                        groups={relatedQuery.data ?? []}
                        isLoading={relatedQuery.isLoading}
                        onLike={handleLike}
                        onSave={handleSave}
                        onShare={(post) => {
                            void sharePost(post, toast)
                        }}
                        onEdit={(post) => {
                            if (post.id === currentPost.id) {
                                setIsEditing(true)
                                return
                            }

                            router.push(buildCommunityPostUrl(post.id))
                        }}
                        onDelete={(post) => {
                            void handleDelete(post)
                        }}
                        onReport={(post, reason) => {
                            void handleReport(post, reason)
                        }}
                    />
                </div>
            </div>

            {isEditing ? (
                <CommunityComposerPanel
                    key={`community-detail-edit-${currentPost.id}`}
                    open
                    mode="edit"
                    initialDraft={getInitialDraft(currentPost)}
                    isSubmitting={updatePostMutation.isPending}
                    onOpenChange={(open) => {
                        if (!open) {
                            setIsEditing(false)
                        }
                    }}
                    onSubmit={(draft) => handleEdit(draft, currentPost)}
                />
            ) : null}
        </div>
    )
}

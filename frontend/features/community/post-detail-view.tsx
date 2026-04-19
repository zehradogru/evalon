'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, PenSquare } from 'lucide-react'
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
import { CommunityEmptyState } from '@/features/community/components/community-empty-state'
import { CommunityPostCard } from '@/features/community/components/community-post-card'
import { CommunityRelatedPostGroups } from '@/features/community/components/community-related-post-groups'
import { buildCommunityPostUrl } from '@/lib/community'
import { useAuthStore } from '@/store/use-auth-store'
import type { CommunityPost, CommunityPostDraft, CommunityReportReason } from '@/types'

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

    if (postQuery.isLoading) {
        return (
            <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
                <div className="h-40 animate-pulse rounded-[2rem] border border-white/10 bg-card/40" />
                <div className="h-32 animate-pulse rounded-[2rem] border border-white/10 bg-card/40" />
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
        <div className="relative overflow-hidden">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_top_left,rgba(40,98,255,0.24),transparent_34%),radial-gradient(circle_at_top_right,rgba(36,166,147,0.16),transparent_24%)]" />

            <div className="mx-auto flex max-w-5xl flex-col gap-8 px-4 py-6 pb-24 sm:px-6">
                <section className="space-y-4">
                    <Button asChild variant="ghost" size="sm" className="-ml-3 w-fit rounded-full">
                        <Link href="/community">
                            <ArrowLeft />
                            Back to community
                        </Link>
                    </Button>

                    <div className="flex flex-col gap-4 rounded-[2.5rem] border border-white/10 bg-[linear-gradient(135deg,rgba(255,255,255,0.05),rgba(255,255,255,0.015))] p-6 shadow-[0_36px_120px_-72px_rgba(0,0,0,0.95)] md:flex-row md:items-end md:justify-between">
                        <div className="space-y-3">
                            <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary/80">
                                Full context
                            </p>
                            <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
                                One post, with the nearby market flow.
                            </h1>
                            <p className="max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                                Read the full note, save it if the setup matters, then compare it with other recent posts around the same tickers.
                            </p>
                        </div>

                        {postQuery.data.isMine ? (
                            <Button size="lg" onClick={() => setIsEditing(true)}>
                                <PenSquare className="size-4" />
                                Edit this post
                            </Button>
                        ) : null}
                    </div>
                </section>

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

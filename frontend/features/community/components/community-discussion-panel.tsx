'use client'

import { MessageCircle } from 'lucide-react'
import {
    useCommunityComments,
    useCreateCommunityComment,
    useDeleteCommunityComment,
    useUpdateCommunityComment,
} from '@/hooks/use-community'
import { useToast } from '@/hooks/use-toast'
import { CommunityCommentComposer } from '@/features/community/components/community-comment-composer'
import { CommunityCommentsList } from '@/features/community/components/community-comments-list'
import { useAuthStore } from '@/store/use-auth-store'
import type { CommunityComment, CommunityCommentDraft } from '@/types'

interface CommunityDiscussionPanelProps {
    postId: string
    commentCount: number
    variant?: 'inline' | 'detail'
}

export function CommunityDiscussionPanel({
    postId,
    commentCount,
    variant = 'detail',
}: CommunityDiscussionPanelProps) {
    const { toast } = useToast()
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const commentsQuery = useCommunityComments(postId)
    const createCommentMutation = useCreateCommunityComment()
    const updateCommentMutation = useUpdateCommunityComment()
    const deleteCommentMutation = useDeleteCommunityComment()

    function requireAuth() {
        toast({
            title: 'Sign in required',
            description: 'Sign in to join the discussion.',
            variant: 'destructive',
        })
    }

    async function handleCreateComment(draft: CommunityCommentDraft) {
        if (!isAuthenticated) {
            requireAuth()
            return
        }

        try {
            await createCommentMutation.mutateAsync({ postId, draft })
            toast({
                title: 'Comment posted',
                description: 'Your comment was added to the discussion.',
            })
        } catch (error) {
            toast({
                title: 'Unable to post comment',
                description:
                    error instanceof Error
                        ? error.message
                        : 'The comment could not be posted.',
                variant: 'destructive',
            })
        }
    }

    async function handleUpdateComment(
        comment: CommunityComment,
        draft: CommunityCommentDraft
    ) {
        try {
            await updateCommentMutation.mutateAsync({
                postId,
                commentId: comment.id,
                draft,
            })
            toast({
                title: 'Comment updated',
                description: 'Your comment changes have been saved.',
            })
        } catch (error) {
            toast({
                title: 'Unable to update comment',
                description:
                    error instanceof Error
                        ? error.message
                        : 'The comment could not be updated.',
                variant: 'destructive',
            })
        }
    }

    async function handleDeleteComment(comment: CommunityComment) {
        if (!window.confirm('Delete this comment permanently?')) {
            return
        }

        try {
            await deleteCommentMutation.mutateAsync({
                postId,
                commentId: comment.id,
            })
            toast({
                title: 'Comment deleted',
                description: 'The comment was removed from the discussion.',
            })
        } catch (error) {
            toast({
                title: 'Unable to delete comment',
                description:
                    error instanceof Error
                        ? error.message
                        : 'The comment could not be deleted.',
                variant: 'destructive',
            })
        }
    }

    return (
        <section id="comments" className="scroll-mt-24 space-y-4">
            {variant === 'detail' ? (
                <div className="flex items-center gap-3">
                    <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <MessageCircle className="size-4" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight">Discussion</h2>
                        <p className="text-xs text-muted-foreground">
                            {commentCount} comment{commentCount === 1 ? '' : 's'}
                        </p>
                    </div>
                </div>
            ) : null}
            <CommunityCommentsList
                comments={commentsQuery.data ?? []}
                isLoading={commentsQuery.isLoading}
                isUpdating={updateCommentMutation.isPending}
                isDeleting={deleteCommentMutation.isPending}
                onUpdate={handleUpdateComment}
                onDelete={handleDeleteComment}
            />
            <CommunityCommentComposer
                isAuthenticated={isAuthenticated}
                isSubmitting={createCommentMutation.isPending}
                onSubmit={handleCreateComment}
                onRequireAuth={requireAuth}
            />
        </section>
    )
}

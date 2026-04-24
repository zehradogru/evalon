'use client'

import { MessageCircle, Pencil, Trash2, X } from 'lucide-react'
import { useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CommunityAvatar } from '@/features/community/components/community-avatar'
import { COMMUNITY_COMMENT_MAX, formatCommunityTimestamp } from '@/lib/community'
import { cn } from '@/lib/utils'
import type { CommunityComment, CommunityCommentDraft } from '@/types'

interface CommunityCommentsListProps {
    comments: CommunityComment[]
    isLoading: boolean
    isUpdating: boolean
    isDeleting: boolean
    onUpdate: (
        comment: CommunityComment,
        draft: CommunityCommentDraft
    ) => Promise<void> | void
    onDelete: (comment: CommunityComment) => Promise<void> | void
}

export function CommunityCommentsList({
    comments,
    isLoading,
    isUpdating,
    isDeleting,
    onUpdate,
    onDelete,
}: CommunityCommentsListProps) {
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editContent, setEditContent] = useState('')

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[0, 1, 2].map((item) => (
                    <div
                        key={item}
                        className="h-24 animate-pulse rounded-2xl border border-white/[0.06] bg-white/[0.03]"
                    />
                ))}
            </div>
        )
    }

    if (comments.length === 0) {
        return (
            <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/[0.08] bg-white/[0.02] px-4 py-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <MessageCircle className="size-5" />
                </div>
                <div className="space-y-1">
                    <h3 className="text-sm font-semibold">No comments yet</h3>
                    <p className="text-sm leading-6 text-muted-foreground">
                        Start the thread with a question, counterpoint, or added context.
                    </p>
                </div>
            </div>
        )
    }

    async function handleUpdate(comment: CommunityComment) {
        const content = editContent.trim()

        if (!content || content.length > COMMUNITY_COMMENT_MAX) return

        await onUpdate(comment, { content })
        setEditingId(null)
        setEditContent('')
    }

    return (
        <div className="space-y-1">
            {comments.map((comment) => {
                const isEditing = editingId === comment.id
                const remainingChars = COMMUNITY_COMMENT_MAX - editContent.length
                const editInvalid =
                    !editContent.trim() ||
                    editContent.trim().length > COMMUNITY_COMMENT_MAX

                return (
                    <article
                        key={comment.id}
                        className="group/comment rounded-2xl border border-transparent px-2 py-3 transition-colors hover:border-white/[0.06] hover:bg-white/[0.025]"
                    >
                        <div className="flex items-start gap-3">
                            <CommunityAvatar
                                name={comment.authorName}
                                size="sm"
                                className="mt-0.5"
                            />
                            <div className="min-w-0 flex-1 space-y-2">
                                <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-sm font-semibold">
                                        {comment.authorName}
                                    </span>
                                    <span className="text-muted-foreground/50">·</span>
                                    <span className="text-xs text-muted-foreground">
                                        {formatCommunityTimestamp(comment.createdAt)}
                                    </span>
                                    {comment.editedAt ? (
                                        <>
                                            <span className="text-muted-foreground/50">·</span>
                                            <span className="text-xs italic text-muted-foreground">
                                                edited
                                            </span>
                                        </>
                                    ) : null}
                                </div>

                                {isEditing ? (
                                    <div className="space-y-2">
                                        <Textarea
                                            value={editContent}
                                            onChange={(event) =>
                                                setEditContent(event.target.value)
                                            }
                                            className="min-h-24 resize-none rounded-xl border-white/[0.08] bg-black/20 text-sm leading-6"
                                            maxLength={COMMUNITY_COMMENT_MAX + 50}
                                            disabled={isUpdating}
                                        />
                                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                            <span
                                                className={cn(
                                                    'text-xs',
                                                    remainingChars < 0
                                                        ? 'text-destructive'
                                                        : 'text-muted-foreground'
                                                )}
                                            >
                                                {remainingChars} characters remaining
                                            </span>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    className="rounded-xl"
                                                    disabled={isUpdating || editInvalid}
                                                    onClick={() => {
                                                        void handleUpdate(comment)
                                                    }}
                                                >
                                                    Save
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="ghost"
                                                    size="icon-sm"
                                                    className="rounded-xl"
                                                    disabled={isUpdating}
                                                    onClick={() => {
                                                        setEditingId(null)
                                                        setEditContent('')
                                                    }}
                                                >
                                                    <X className="size-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <p className="whitespace-pre-wrap text-sm leading-7 text-foreground/85">
                                        {comment.content}
                                    </p>
                                )}
                            </div>

                            {comment.isMine && !isEditing ? (
                                <div className="flex shrink-0 items-center gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover/comment:opacity-100">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="rounded-xl text-muted-foreground"
                                        onClick={() => {
                                            setEditingId(comment.id)
                                            setEditContent(comment.content)
                                        }}
                                    >
                                        <Pencil className="size-4" />
                                    </Button>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon-sm"
                                        className="rounded-xl text-muted-foreground hover:text-destructive"
                                        disabled={isDeleting}
                                        onClick={() => {
                                            void onDelete(comment)
                                        }}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    </article>
                )
            })}
        </div>
    )
}

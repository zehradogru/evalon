'use client'

import { SendHorizonal } from 'lucide-react'
import Link from 'next/link'
import { useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { CommunityAvatar } from '@/features/community/components/community-avatar'
import { COMMUNITY_COMMENT_MAX } from '@/lib/community'
import { useAuthStore } from '@/store/use-auth-store'
import type { CommunityCommentDraft } from '@/types'

interface CommunityCommentComposerProps {
    isAuthenticated: boolean
    isSubmitting: boolean
    onSubmit: (draft: CommunityCommentDraft) => Promise<void> | void
    onRequireAuth: () => void
}

function getComposerName(user: ReturnType<typeof useAuthStore.getState>['user']) {
    return user?.name?.trim() || user?.email?.split('@')[0]?.trim() || 'Trader'
}

export function CommunityCommentComposer({
    isAuthenticated,
    isSubmitting,
    onSubmit,
    onRequireAuth,
}: CommunityCommentComposerProps) {
    const user = useAuthStore((state) => state.user)
    const composerName = getComposerName(user)
    const [content, setContent] = useState('')
    const normalizedContent = content.trim()
    const remainingChars = COMMUNITY_COMMENT_MAX - content.length
    const error = useMemo(() => {
        if (!normalizedContent) return 'Write a comment before posting.'
        if (normalizedContent.length > COMMUNITY_COMMENT_MAX) {
            return `Comment must be ${COMMUNITY_COMMENT_MAX} characters or fewer.`
        }
        return null
    }, [normalizedContent])

    async function handleSubmit() {
        if (!isAuthenticated) {
            onRequireAuth()
            return
        }

        if (error) return

        await onSubmit({ content: normalizedContent })
        setContent('')
    }

    if (!isAuthenticated) {
        return (
            <div className="flex flex-col gap-3 rounded-2xl border border-white/[0.08] bg-black/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-3">
                    <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-xs font-semibold text-muted-foreground">
                        ?
                    </div>
                    <div>
                        <p className="text-sm font-medium">Join the discussion</p>
                        <p className="text-xs text-muted-foreground">
                            Sign in to reply while keeping the thread readable for everyone.
                        </p>
                    </div>
                </div>
                <Button asChild size="sm" className="rounded-xl">
                    <Link href="/login">Sign in</Link>
                </Button>
            </div>
        )
    }

	    return (
	        <div className="rounded-2xl border border-white/[0.08] bg-black/20 p-3 shadow-inner shadow-black/20">
	            <div className="flex gap-3">
	                <CommunityAvatar name={composerName} size="sm" className="mt-2" />
	                <Textarea
	                    value={content}
	                    onChange={(event) => setContent(event.target.value)}
	                    placeholder="Add a thought, question, or counterpoint..."
	                    disabled={isSubmitting}
	                    className="min-h-16 flex-1 resize-none rounded-xl border-white/[0.06] bg-white/[0.035] px-4 py-3 text-sm leading-6 shadow-none focus-visible:ring-1"
	                    maxLength={COMMUNITY_COMMENT_MAX + 50}
	                />
	            </div>
            <div className="mt-2 flex flex-col gap-2 border-t border-white/[0.06] pt-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-h-5 text-xs">
                    {error && content ? (
                        <span className="text-destructive">{error}</span>
                    ) : (
                        <span className="text-muted-foreground">
                            {remainingChars} left
                        </span>
                    )}
                </div>
                <Button
                    type="button"
                    size="sm"
                    className="w-full rounded-xl sm:w-fit"
                    disabled={isSubmitting || (isAuthenticated && Boolean(error))}
                    onClick={() => {
                        void handleSubmit()
                    }}
                >
                    <SendHorizonal className="size-4" />
                    {isSubmitting ? 'Posting...' : 'Reply'}
                </Button>
            </div>
        </div>
    )
}

'use client'

import { PenSquare } from 'lucide-react'

import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet'
import { useCommunityComposer } from '@/hooks/use-community'
import { CommunityComposer } from '@/features/community/components/community-composer'
import type { CommunityPostDraft } from '@/types'

interface CommunityComposerPanelProps {
    open: boolean
    mode: 'create' | 'edit'
    initialDraft?: Partial<CommunityPostDraft>
    isSubmitting?: boolean
    onOpenChange: (open: boolean) => void
    onSubmit: (draft: CommunityPostDraft) => Promise<void> | void
}

export function CommunityComposerPanel({
    open,
    mode,
    initialDraft,
    isSubmitting = false,
    onOpenChange,
    onSubmit,
}: CommunityComposerPanelProps) {
    const composer = useCommunityComposer(initialDraft)

    function requestClose() {
        if (
            composer.isDirty &&
            !window.confirm('Discard the changes in this post editor?')
        ) {
            return
        }

        onOpenChange(false)
    }

    return (
        <Sheet
            open={open}
            onOpenChange={(nextOpen) => {
                if (!nextOpen) {
                    requestClose()
                    return
                }

                onOpenChange(true)
            }}
        >
            <SheetContent
                side="right"
                className="gap-0 overflow-hidden border-white/10 bg-[#050505] p-0 sm:max-w-[42rem] max-sm:inset-x-0 max-sm:inset-y-auto max-sm:bottom-0 max-sm:top-auto max-sm:h-[92dvh] max-sm:max-w-none max-sm:rounded-t-[2rem] max-sm:border-l-0 max-sm:border-t"
            >
                <SheetHeader className="relative overflow-hidden border-border/60 bg-[radial-gradient(circle_at_top_left,rgba(40,98,255,0.24),transparent_36%),radial-gradient(circle_at_top_right,rgba(36,166,147,0.18),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] pr-16">
                    <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
                        <PenSquare className="size-3.5" />
                        {mode === 'create' ? 'New community post' : 'Edit community post'}
                    </div>
                    <SheetTitle>
                        {mode === 'create'
                            ? 'Write once, make the setup legible'
                            : 'Refine the thesis before it scrolls by'}
                    </SheetTitle>
                    <SheetDescription className="max-w-xl leading-6">
                        {mode === 'create'
                            ? 'Publish a concise idea with optional chart context, ticker tags, and one strong visual anchor.'
                            : 'Update the text, tags, or hero image without breaking the original trail.'}
                    </SheetDescription>
                </SheetHeader>

                <CommunityComposer
                    mode={mode}
                    composer={composer}
                    isSubmitting={isSubmitting}
                    onSubmit={onSubmit}
                    onCancel={requestClose}
                />
            </SheetContent>
        </Sheet>
    )
}

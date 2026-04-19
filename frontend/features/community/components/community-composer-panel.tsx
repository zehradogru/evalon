'use client'

import { PenSquare, Sparkles } from 'lucide-react'

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
                className="gap-0 overflow-hidden border-white/[0.06] bg-[#030303] p-0 sm:max-w-[42rem] max-sm:inset-x-0 max-sm:inset-y-auto max-sm:bottom-0 max-sm:top-auto max-sm:h-[92dvh] max-sm:max-w-none max-sm:rounded-t-2xl max-sm:border-l-0 max-sm:border-t"
            >
                <SheetHeader className="relative overflow-hidden pr-16">
                    {/* Animated gradient background */}
                    <div className="pointer-events-none absolute inset-0">
                        <div className="animate-aurora absolute -left-20 -top-10 h-48 w-64 rounded-full bg-[radial-gradient(ellipse,rgba(40,98,255,0.2),transparent_60%)] blur-2xl" />
                        <div className="animate-aurora animation-delay-2000 absolute -right-10 top-0 h-40 w-56 rounded-full bg-[radial-gradient(ellipse,rgba(36,166,147,0.15),transparent_60%)] blur-2xl" />
                    </div>

                    {/* Top accent line */}
                    <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />

                    <div className="relative mb-3 inline-flex w-fit items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
                        {mode === 'create' ? (
                            <Sparkles className="size-3.5 text-primary" />
                        ) : (
                            <PenSquare className="size-3.5 text-primary" />
                        )}
                        {mode === 'create' ? 'New post' : 'Edit post'}
                    </div>
                    <SheetTitle className="relative text-xl font-bold">
                        {mode === 'create'
                            ? 'Write once, make it legible'
                            : 'Refine before it scrolls by'}
                    </SheetTitle>
                    <SheetDescription className="relative max-w-xl text-sm leading-6">
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

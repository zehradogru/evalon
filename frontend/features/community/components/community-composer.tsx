'use client'

import { useState } from 'react'
import { ImagePlus, RotateCcw, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCommunityComposer } from '@/hooks/use-community'
import { COMMUNITY_CONTENT_MAX } from '@/lib/community'
import { cn } from '@/lib/utils'
import type { CommunityPostDraft } from '@/types'

interface CommunityComposerProps {
    mode: 'create' | 'edit'
    composer: ReturnType<typeof useCommunityComposer>
    isSubmitting?: boolean
    onSubmit: (draft: CommunityPostDraft) => Promise<void> | void
    onCancel?: () => void
}

export function CommunityComposer({
    mode,
    composer,
    isSubmitting = false,
    onSubmit,
    onCancel,
}: CommunityComposerProps) {
    const [tickerInput, setTickerInput] = useState('')
    const [tagInput, setTagInput] = useState('')
    const [fileInputKey, setFileInputKey] = useState(0)

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()

        if (composer.submitDisabled || isSubmitting) return

        await onSubmit(composer.normalizedDraft)

        if (mode === 'create') {
            composer.reset()
            setTickerInput('')
            setTagInput('')
            setFileInputKey((current) => current + 1)
        }
    }

    function commitTickerInput() {
        composer.addTickersFromInput(tickerInput)
        setTickerInput('')
    }

    function commitTagInput() {
        composer.addTagsFromInput(tagInput)
        setTagInput('')
    }

    function handleFileSelection(file: File | null) {
        if (!file) return

        const attached = composer.attachImage(file)

        if (attached) {
            setFileInputKey((current) => current + 1)
        }
    }

    function handleClearImage() {
        composer.clearImage()
        setFileInputKey((current) => current + 1)
    }

    return (
        <form
            className="flex h-full flex-col"
            onSubmit={handleSubmit}
            onPasteCapture={(event) => {
                const imageItem = Array.from(event.clipboardData.items).find((item) =>
                    item.type.startsWith('image/')
                )

                if (!imageItem) return

                const file = imageItem.getAsFile()

                if (!file) return

                event.preventDefault()
                handleFileSelection(file)
            }}
        >
            <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
                <section className="rounded-3xl border border-border/60 bg-white/[0.02] p-4 shadow-[0_24px_80px_-48px_rgba(40,98,255,0.8)]">
                    <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-[0.28em] text-primary/80">
                            Thesis
                        </p>
                        <Textarea
                            value={composer.content}
                            onChange={(event) => composer.setContent(event.target.value)}
                            placeholder="What is moving, what matters, and where are you positioned?"
                            className="min-h-40 resize-none rounded-3xl border-white/10 bg-black/40 px-4 py-4 text-base leading-7 shadow-none"
                            maxLength={COMMUNITY_CONTENT_MAX}
                        />
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-destructive">
                                {composer.errors.content || ''}
                            </span>
                            <span
                                className={cn(
                                    'text-muted-foreground',
                                    composer.remainingChars < 0 && 'text-destructive'
                                )}
                            >
                                {composer.remainingChars} characters left
                            </span>
                        </div>
                    </div>
                </section>

                <section className="rounded-3xl border border-border/60 bg-white/[0.02] p-4">
                    <div className="mb-3 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold">Hero image</p>
                            <p className="text-xs text-muted-foreground">
                                Add one chart, screenshot, or setup image. Paste from clipboard or upload a file.
                            </p>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            <input
                                key={fileInputKey}
                                type="file"
                                accept={composer.imageInputAccept}
                                className="hidden"
                                id={`community-image-${mode}`}
                                onChange={(event) =>
                                    handleFileSelection(event.target.files?.[0] ?? null)
                                }
                            />
                            <Button asChild type="button" variant="outline" size="sm">
                                <label
                                    htmlFor={`community-image-${mode}`}
                                    className="cursor-pointer"
                                >
                                    <ImagePlus className="size-4" />
                                    {composer.hasImage ? 'Replace image' : 'Add image'}
                                </label>
                            </Button>
                            {composer.hasImage ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={handleClearImage}
                                >
                                    <Trash2 className="size-4" />
                                    Remove
                                </Button>
                            ) : null}
                            {composer.canRestoreImage ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={composer.restoreExistingImage}
                                >
                                    <RotateCcw className="size-4" />
                                    Restore
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    {composer.hasImage && composer.activeImageUrl ? (
                        <div className="overflow-hidden rounded-[1.75rem] border border-border/60 bg-black">
                            <img
                                src={composer.activeImageUrl}
                                alt="Post preview"
                                className="h-auto max-h-[24rem] w-full object-cover"
                            />
                        </div>
                    ) : (
                        <div className="flex min-h-52 flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-border/60 bg-black/30 px-6 text-center">
                            <div className="mb-4 flex size-14 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                                <ImagePlus className="size-6" />
                            </div>
                            <p className="text-base font-semibold">
                                Drop in a visual anchor
                            </p>
                            <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                                Use one strong chart, markup, or screenshot to make your post easier to scan. JPEG, PNG, and WEBP are supported.
                            </p>
                        </div>
                    )}

                    {composer.removeImageRequested && !composer.hasImage ? (
                        <p className="mt-3 text-xs text-amber-400">
                            The current image will be removed when you save.
                        </p>
                    ) : null}

                    {composer.errors.image ? (
                        <p className="mt-3 text-xs text-destructive">
                            {composer.errors.image}
                        </p>
                    ) : null}
                </section>

                <section className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-3xl border border-border/60 bg-white/[0.02] p-4">
                        <div className="mb-3 space-y-1">
                            <p className="text-sm font-semibold">Tickers</p>
                            <p className="text-xs text-muted-foreground">
                                Up to 3 symbols. They will be normalized to uppercase.
                            </p>
                        </div>
                        <Input
                            value={tickerInput}
                            onChange={(event) => setTickerInput(event.target.value)}
                            onBlur={commitTickerInput}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ',') {
                                    event.preventDefault()
                                    commitTickerInput()
                                }
                            }}
                            placeholder="THYAO, ASELS, BIMAS"
                            className="rounded-2xl"
                        />
                        <div className="mt-3 flex min-h-8 flex-wrap gap-2">
                            {composer.tickers.map((ticker) => (
                                <Badge
                                    key={ticker}
                                    className="gap-1 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-primary"
                                >
                                    ${ticker}
                                    <button
                                        type="button"
                                        onClick={() => composer.removeTicker(ticker)}
                                    >
                                        <X className="size-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        {composer.errors.tickers ? (
                            <p className="mt-3 text-xs text-destructive">
                                {composer.errors.tickers}
                            </p>
                        ) : null}
                    </div>

                    <div className="rounded-3xl border border-border/60 bg-white/[0.02] p-4">
                        <div className="mb-3 space-y-1">
                            <p className="text-sm font-semibold">Tags</p>
                            <p className="text-xs text-muted-foreground">
                                Up to 3 descriptors. They will be normalized to lowercase.
                            </p>
                        </div>
                        <Input
                            value={tagInput}
                            onChange={(event) => setTagInput(event.target.value)}
                            onBlur={commitTagInput}
                            onKeyDown={(event) => {
                                if (event.key === 'Enter' || event.key === ',') {
                                    event.preventDefault()
                                    commitTagInput()
                                }
                            }}
                            placeholder="breakout, swing, reaction"
                            className="rounded-2xl"
                        />
                        <div className="mt-3 flex min-h-8 flex-wrap gap-2">
                            {composer.tags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="outline"
                                    className="gap-1 rounded-full px-3 py-1"
                                >
                                    #{tag}
                                    <button
                                        type="button"
                                        onClick={() => composer.removeTag(tag)}
                                    >
                                        <X className="size-3" />
                                    </button>
                                </Badge>
                            ))}
                        </div>
                        {composer.errors.tags ? (
                            <p className="mt-3 text-xs text-destructive">
                                {composer.errors.tags}
                            </p>
                        ) : null}
                    </div>
                </section>
            </div>

            <div className="border-t border-border/60 bg-background/95 px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-muted-foreground">
                        {mode === 'create'
                            ? 'Publishing creates a new community post immediately.'
                            : 'Saving updates the existing post in place.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {onCancel ? (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={onCancel}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        ) : null}
                        <Button type="submit" disabled={composer.submitDisabled || isSubmitting}>
                            {isSubmitting
                                ? mode === 'create'
                                    ? 'Publishing...'
                                    : 'Saving...'
                                : mode === 'create'
                                  ? 'Publish post'
                                  : 'Save changes'}
                        </Button>
                    </div>
                </div>
            </div>
        </form>
    )
}

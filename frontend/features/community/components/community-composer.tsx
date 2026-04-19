'use client'

import { useState } from 'react'
import { ImagePlus, RotateCcw, Trash2, Upload, X } from 'lucide-react'

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
    const [isDragging, setIsDragging] = useState(false)

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

    /* Character counter progress */
    const charProgress = Math.min(
        100,
        ((composer.content.length) / COMMUNITY_CONTENT_MAX) * 100
    )
    const isNearLimit = charProgress > 85
    const isOverLimit = composer.remainingChars < 0

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
            <div className="flex-1 space-y-5 overflow-y-auto px-6 py-6">
                {/* -------- Thesis section -------- */}
                <section className="group/section rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-500 hover:border-white/[0.1] hover:shadow-[0_4px_24px_-8px_rgba(40,98,255,0.1)]">
                    <div className="mb-3 flex items-center justify-between">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-primary/80">
                            Thesis
                        </p>
                        {/* Circular progress indicator */}
                        <div className="flex items-center gap-2">
                            <svg width="20" height="20" viewBox="0 0 20 20" className="rotate-[-90deg]">
                                <circle cx="10" cy="10" r="8" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
                                <circle
                                    cx="10" cy="10" r="8" fill="none"
                                    stroke={isOverLimit ? '#f23645' : isNearLimit ? '#ef9005' : '#2862ff'}
                                    strokeWidth="2"
                                    strokeDasharray={`${2 * Math.PI * 8}`}
                                    strokeDashoffset={`${2 * Math.PI * 8 * (1 - charProgress / 100)}`}
                                    strokeLinecap="round"
                                    className="transition-all duration-300"
                                />
                            </svg>
                            <span className={cn(
                                'text-[11px] tabular-nums',
                                isOverLimit ? 'text-destructive' : isNearLimit ? 'text-amber-400' : 'text-muted-foreground'
                            )}>
                                {composer.remainingChars}
                            </span>
                        </div>
                    </div>
                    <Textarea
                        value={composer.content}
                        onChange={(event) => composer.setContent(event.target.value)}
                        placeholder="What is moving, what matters, and where are you positioned?"
                        className="min-h-36 resize-none rounded-xl border-white/[0.06] bg-black/40 px-4 py-4 text-[15px] leading-7 shadow-none transition-colors duration-300 focus:border-primary/30 focus:bg-black/60"
                        maxLength={COMMUNITY_CONTENT_MAX}
                    />
                    {composer.errors.content ? (
                        <p className="mt-2 text-xs text-destructive">{composer.errors.content}</p>
                    ) : null}
                </section>

                {/* -------- Hero image section -------- */}
                <section className="group/section rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-500 hover:border-white/[0.1]">
                    <div className="mb-3 flex items-center justify-between gap-4">
                        <div className="space-y-1">
                            <p className="text-sm font-semibold">Hero image</p>
                            <p className="text-[11px] text-muted-foreground">
                                Chart, screenshot, or setup image. Paste or upload.
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
                            <Button asChild type="button" variant="outline" size="sm" className="rounded-xl">
                                <label
                                    htmlFor={`community-image-${mode}`}
                                    className="cursor-pointer"
                                >
                                    <ImagePlus className="size-4" />
                                    {composer.hasImage ? 'Replace' : 'Upload'}
                                </label>
                            </Button>
                            {composer.hasImage ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="rounded-xl text-muted-foreground hover:text-destructive"
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
                                    className="rounded-xl"
                                    onClick={composer.restoreExistingImage}
                                >
                                    <RotateCcw className="size-4" />
                                    Restore
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    {composer.hasImage && composer.activeImageUrl ? (
                        <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-black">
                            {/* Preview uses blob URLs and direct Firebase URLs, so keep a plain img element here. */}
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                                src={composer.activeImageUrl}
                                alt="Post preview"
                                className="h-auto max-h-[24rem] w-full object-cover"
                            />
                        </div>
                    ) : (
                        <div
                            className={cn(
                                'relative flex min-h-48 flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 text-center transition-all duration-300',
                                isDragging
                                    ? 'border-primary bg-primary/[0.06] shadow-[0_0_24px_-4px_rgba(40,98,255,0.2)]'
                                    : 'border-white/[0.08] bg-black/20 hover:border-white/[0.12] hover:bg-black/30'
                            )}
                            onDragOver={(e) => {
                                e.preventDefault()
                                setIsDragging(true)
                            }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                                e.preventDefault()
                                setIsDragging(false)
                                const file = e.dataTransfer.files?.[0]
                                if (file) handleFileSelection(file)
                            }}
                        >
                            <div className={cn(
                                'mb-3 flex size-12 items-center justify-center rounded-xl transition-all duration-500',
                                isDragging
                                    ? 'scale-110 bg-primary/20 text-primary'
                                    : 'bg-white/[0.04] text-muted-foreground'
                            )}>
                                {isDragging ? (
                                    <Upload className="size-5" />
                                ) : (
                                    <ImagePlus className="size-5" />
                                )}
                            </div>
                            <p className="text-sm font-medium">
                                {isDragging ? 'Drop your image here' : 'Add a visual anchor'}
                            </p>
                            <p className="mt-1.5 max-w-sm text-[11px] leading-5 text-muted-foreground">
                                Drag & drop, paste from clipboard, or click Upload. JPEG, PNG, WEBP supported.
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

                {/* -------- Tickers & Tags -------- */}
                <section className="grid gap-4 md:grid-cols-2">
                    <div className="group/section rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-500 hover:border-white/[0.1]">
                        <div className="mb-3 space-y-1">
                            <p className="text-sm font-semibold">Tickers</p>
                            <p className="text-[11px] text-muted-foreground">
                                Up to 3 symbols. Normalized to uppercase.
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
                            className="rounded-xl border-white/[0.06] bg-black/40 transition-colors focus:border-primary/30"
                        />
                        <div className="mt-3 flex min-h-8 flex-wrap gap-1.5">
                            {composer.tickers.map((ticker) => (
                                <Badge
                                    key={ticker}
                                    className="gap-1 rounded-lg border-0 bg-primary/10 px-2.5 py-1 text-primary transition-all hover:bg-primary/20"
                                >
                                    ${ticker}
                                    <button
                                        type="button"
                                        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-primary/20"
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

                    <div className="group/section rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 transition-all duration-500 hover:border-white/[0.1]">
                        <div className="mb-3 space-y-1">
                            <p className="text-sm font-semibold">Tags</p>
                            <p className="text-[11px] text-muted-foreground">
                                Up to 3 descriptors. Normalized to lowercase.
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
                            className="rounded-xl border-white/[0.06] bg-black/40 transition-colors focus:border-primary/30"
                        />
                        <div className="mt-3 flex min-h-8 flex-wrap gap-1.5">
                            {composer.tags.map((tag) => (
                                <Badge
                                    key={tag}
                                    variant="outline"
                                    className="gap-1 rounded-lg border-white/[0.08] bg-white/[0.03] px-2.5 py-1 transition-all hover:border-white/[0.15]"
                                >
                                    #{tag}
                                    <button
                                        type="button"
                                        className="ml-0.5 rounded-full p-0.5 transition-colors hover:bg-white/10"
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

            {/* -------- Footer -------- */}
            <div className="border-t border-white/[0.06] bg-background/95 px-6 py-4 backdrop-blur-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-[11px] text-muted-foreground">
                        {mode === 'create'
                            ? 'Publishing creates a new community post immediately.'
                            : 'Saving updates the existing post in place.'}
                    </p>
                    <div className="flex flex-wrap items-center gap-2">
                        {onCancel ? (
                            <Button
                                type="button"
                                variant="ghost"
                                className="rounded-xl"
                                onClick={onCancel}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                        ) : null}
                        <Button
                            type="submit"
                            className="rounded-xl shadow-[0_4px_16px_-4px_rgba(40,98,255,0.5)]"
                            disabled={composer.submitDisabled || isSubmitting}
                        >
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

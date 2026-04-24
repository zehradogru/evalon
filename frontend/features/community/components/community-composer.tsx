'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
    ImagePlus,
    Loader2,
    RotateCcw,
    Search,
    Trash2,
    Upload,
    X,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { useCommunityComposer } from '@/hooks/use-community'
import {
    COMMUNITY_CONTENT_MAX,
    COMMUNITY_MAX_TICKERS,
    normalizeTicker,
} from '@/lib/community'
import { cn } from '@/lib/utils'
import type { CommunityPostDraft } from '@/types'

interface CommunityComposerProps {
    mode: 'create' | 'edit'
    composer: ReturnType<typeof useCommunityComposer>
    isSubmitting?: boolean
    onSubmit: (draft: CommunityPostDraft) => Promise<void> | void
    onCancel?: () => void
}

interface TickerSuggestion {
    ticker: string
    name: string
    changePct: number | null
}

async function fetchTickerSuggestions(searchQuery: string): Promise<TickerSuggestion[]> {
    const params = new URLSearchParams({
        view: 'markets',
        limit: '8',
        sortBy: 'ticker',
        sortDir: 'asc',
        q: searchQuery,
    })

    const response = await fetch(`/api/markets/list?${params.toString()}`)
    if (!response.ok) {
        throw new Error('Failed to search tickers')
    }

    const payload: {
        items: Array<{ ticker: string; name: string; changePct: number | null }>
    } = await response.json()

    return payload.items.map((item) => ({
        ticker: item.ticker,
        name: item.name,
        changePct: item.changePct,
    }))
}

function formatChangePct(value: number | null) {
    if (value === null) return null
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}%`
}

export function CommunityComposer({
    mode,
    composer,
    isSubmitting = false,
    onSubmit,
    onCancel,
}: CommunityComposerProps) {
    const [tickerInput, setTickerInput] = useState('')
    const [debouncedTickerInput, setDebouncedTickerInput] = useState('')
    const [isTickerSearchFocused, setIsTickerSearchFocused] = useState(false)
    const [tagInput, setTagInput] = useState('')
    const [fileInputKey, setFileInputKey] = useState(0)
    const [isDragging, setIsDragging] = useState(false)

    useEffect(() => {
        const timeout = setTimeout(() => {
            setDebouncedTickerInput(normalizeTicker(tickerInput))
        }, 220)

        return () => clearTimeout(timeout)
    }, [tickerInput])

    const {
        data: tickerSuggestions = [],
        isLoading: isTickerSuggestionsLoading,
        isError: isTickerSuggestionsError,
    } = useQuery({
        queryKey: ['community-ticker-suggestions', debouncedTickerInput],
        queryFn: () => fetchTickerSuggestions(debouncedTickerInput),
        enabled: debouncedTickerInput.length > 0,
        staleTime: 30 * 1000,
    })

    const availableTickerSuggestions = useMemo(
        () =>
            tickerSuggestions.filter(
                (item) => !composer.tickers.includes(normalizeTicker(item.ticker))
            ),
        [composer.tickers, tickerSuggestions]
    )

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

    function selectTicker(ticker: string) {
        composer.addTickersFromInput(ticker)
        setTickerInput('')
        setDebouncedTickerInput('')
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
	                                Search and select up to {COMMUNITY_MAX_TICKERS} symbols.
	                            </p>
	                        </div>
	                        <div className="relative">
	                            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
	                            <Input
	                                value={tickerInput}
	                                onChange={(event) => setTickerInput(event.target.value)}
	                                onFocus={() => setIsTickerSearchFocused(true)}
	                                onBlur={() => {
	                                    window.setTimeout(() => {
	                                        setIsTickerSearchFocused(false)
	                                        commitTickerInput()
	                                    }, 120)
	                                }}
	                                onKeyDown={(event) => {
	                                    if (event.key === 'Enter' || event.key === ',') {
	                                        event.preventDefault()
	                                        commitTickerInput()
	                                    }
	                                }}
	                                placeholder="Search ticker or company..."
	                                disabled={composer.tickers.length >= COMMUNITY_MAX_TICKERS}
	                                className="rounded-xl border-white/[0.06] bg-black/40 pl-9 transition-colors focus:border-primary/30 disabled:opacity-60"
	                            />
	                            {isTickerSearchFocused && tickerInput.trim() ? (
	                                <div className="absolute z-20 mt-2 max-h-72 w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-background/95 shadow-[0_18px_60px_-24px_rgba(0,0,0,0.9)] backdrop-blur-xl">
	                                    {isTickerSuggestionsLoading ? (
	                                        <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
	                                            <Loader2 className="size-4 animate-spin" />
	                                            Searching tickers...
	                                        </div>
	                                    ) : isTickerSuggestionsError ? (
	                                        <div className="px-3 py-3 text-sm text-destructive">
	                                            Ticker search failed. You can still press Enter to add manually.
	                                        </div>
	                                    ) : availableTickerSuggestions.length > 0 ? (
	                                        <div className="max-h-72 overflow-y-auto p-1.5">
	                                            {availableTickerSuggestions.map((item) => {
	                                                const changeLabel = formatChangePct(item.changePct)
	                                                return (
	                                                    <button
	                                                        key={item.ticker}
	                                                        type="button"
	                                                        className="flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-white/[0.05]"
	                                                        onMouseDown={(event) => event.preventDefault()}
	                                                        onClick={() => selectTicker(item.ticker)}
	                                                    >
	                                                        <span className="min-w-0">
	                                                            <span className="block text-sm font-semibold text-foreground">
	                                                                {item.ticker}
	                                                            </span>
	                                                            <span className="block truncate text-xs text-muted-foreground">
	                                                                {item.name}
	                                                            </span>
	                                                        </span>
	                                                        <span
	                                                            className={cn(
	                                                                'shrink-0 rounded-full px-2 py-0.5 text-xs tabular-nums',
	                                                                item.changePct === null
	                                                                    ? 'bg-white/[0.04] text-muted-foreground'
	                                                                    : item.changePct >= 0
	                                                                      ? 'bg-emerald-500/10 text-emerald-400'
	                                                                      : 'bg-rose-500/10 text-rose-400'
	                                                            )}
	                                                        >
	                                                            {changeLabel ?? 'n/a'}
	                                                        </span>
	                                                    </button>
	                                                )
	                                            })}
	                                        </div>
	                                    ) : (
	                                        <div className="px-3 py-3 text-sm text-muted-foreground">
	                                            No exact result. Press Enter to add{' '}
	                                            <span className="font-semibold text-foreground">
	                                                {normalizeTicker(tickerInput)}
	                                            </span>
	                                            .
	                                        </div>
	                                    )}
	                                </div>
	                            ) : null}
	                        </div>
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

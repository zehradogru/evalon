'use client'

import { Minus, Plus, RotateCcw, X } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { Button } from '@/components/ui/button'

interface CommunityImageLightboxProps {
    imageUrl: string
    alt: string
    open: boolean
    onOpenChange: (open: boolean) => void
}

const MIN_ZOOM = 1
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

export function CommunityImageLightbox({
    imageUrl,
    alt,
    open,
    onOpenChange,
}: CommunityImageLightboxProps) {
    const [zoom, setZoom] = useState(1)

    const closeLightbox = useCallback(() => {
        setZoom(1)
        onOpenChange(false)
    }, [onOpenChange])

    useEffect(() => {
        if (!open) {
            return
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                closeLightbox()
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [closeLightbox, open])

    if (!open) return null

    const canZoomOut = zoom > MIN_ZOOM
    const canZoomIn = zoom < MAX_ZOOM

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
            role="dialog"
            aria-modal="true"
            aria-label="Expanded community image"
        >
            <button
                type="button"
                className="absolute inset-0 cursor-zoom-out"
                aria-label="Close image preview"
                onClick={closeLightbox}
            />

            <div className="relative z-10 flex h-full w-full max-w-7xl flex-col gap-3">
                <div className="flex items-center justify-end gap-2">
                    <div className="flex items-center gap-1 rounded-full border border-white/10 bg-white/10 p-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full text-white hover:bg-white/15 hover:text-white"
                            disabled={!canZoomOut}
                            onClick={() =>
                                setZoom((current) =>
                                    Math.max(current - ZOOM_STEP, MIN_ZOOM)
                                )
                            }
                        >
                            <Minus className="size-4" />
                        </Button>
                        <span className="min-w-14 text-center text-xs font-medium text-white/80">
                            {Math.round(zoom * 100)}%
                        </span>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full text-white hover:bg-white/15 hover:text-white"
                            disabled={!canZoomIn}
                            onClick={() =>
                                setZoom((current) =>
                                    Math.min(current + ZOOM_STEP, MAX_ZOOM)
                                )
                            }
                        >
                            <Plus className="size-4" />
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="rounded-full text-white hover:bg-white/15 hover:text-white"
                            disabled={zoom === 1}
                            onClick={() => setZoom(1)}
                        >
                            <RotateCcw className="size-4" />
                        </Button>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="rounded-full bg-white/10 text-white hover:bg-white/15 hover:text-white"
                        onClick={closeLightbox}
                    >
                        <X className="size-5" />
                    </Button>
                </div>

                <div className="relative min-h-0 flex-1 overflow-auto rounded-2xl border border-white/10 bg-black/40">
                    <div className="flex min-h-full min-w-full items-center justify-center p-4">
                        {/* Community media comes from Firebase-managed public URLs and should render without image optimizer coupling. */}
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={imageUrl}
                            alt={alt}
                            className="select-none object-contain transition-[width,max-height] duration-200"
                            style={{
                                width: `${zoom * 100}%`,
                                maxWidth: zoom === 1 ? '100%' : 'none',
                                maxHeight:
                                    zoom === 1 ? 'calc(100vh - 8rem)' : 'none',
                                cursor: zoom > 1 ? 'move' : 'default',
                            }}
                            draggable={false}
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}

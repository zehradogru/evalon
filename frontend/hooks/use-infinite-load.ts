'use client'

import { useEffect, useRef } from 'react'

interface UseInfiniteLoadParams {
    canLoadMore: boolean
    isLoadingMore: boolean
    onLoadMore: () => void
    rootMargin?: string
}

export function useInfiniteLoad({
    canLoadMore,
    isLoadingMore,
    onLoadMore,
    rootMargin = '300px',
}: UseInfiniteLoadParams) {
    const sentinelRef = useRef<HTMLDivElement | null>(null)

    useEffect(() => {
        const target = sentinelRef.current
        if (!target) return

        const observer = new IntersectionObserver(
            (entries) => {
                const entry = entries[0]
                if (!entry.isIntersecting) return
                if (!canLoadMore || isLoadingMore) return
                onLoadMore()
            },
            { rootMargin }
        )

        observer.observe(target)
        return () => observer.disconnect()
    }, [canLoadMore, isLoadingMore, onLoadMore, rootMargin])

    return { sentinelRef }
}

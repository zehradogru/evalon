import type {
    CommunityPost,
    CommunityPostDraft,
    CommunityReportReason,
} from '@/types'

export const COMMUNITY_PAGE_SIZE = 20
export const COMMUNITY_POST_COOLDOWN_MS = 30_000
export const COMMUNITY_CONTENT_MAX = 500
export const COMMUNITY_MAX_TICKERS = 3
export const COMMUNITY_MAX_TAGS = 3
export const COMMUNITY_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024
export const COMMUNITY_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp'
export const COMMUNITY_ALLOWED_IMAGE_TYPES = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
])
export const COMMUNITY_REPORT_REASONS: CommunityReportReason[] = [
    'Spam',
    'Harassment',
    'Misinformation',
    'Off-topic',
    'Other',
]

function normalizeWhitespace(value: string) {
    return value.trim().replace(/\s+/g, ' ')
}

export function normalizeTicker(value: string) {
    return normalizeWhitespace(value).toUpperCase()
}

export function normalizeTag(value: string) {
    return normalizeWhitespace(value).toLowerCase()
}

export function parseChipInput(
    value: string,
    normalizer: (value: string) => string,
    limit: number
) {
    const seen = new Set<string>()

    return value
        .split(/[,\n]/)
        .map((entry) => normalizer(entry))
        .filter((entry) => {
            if (!entry || seen.has(entry)) return false
            seen.add(entry)
            return true
        })
        .slice(0, limit)
}

export function normalizeCommunityDraft(
    draft: CommunityPostDraft
): CommunityPostDraft {
    return {
        content: draft.content.trim(),
        tickers: draft.tickers
            .map(normalizeTicker)
            .filter(Boolean)
            .filter((value, index, values) => values.indexOf(value) === index)
            .slice(0, COMMUNITY_MAX_TICKERS),
        tags: draft.tags
            .map(normalizeTag)
            .filter(Boolean)
            .filter((value, index, values) => values.indexOf(value) === index)
            .slice(0, COMMUNITY_MAX_TAGS),
        image: draft.image
            ? {
                  file: draft.image.file ?? null,
                  existingUrl: draft.image.existingUrl ?? null,
                  existingPath: draft.image.existingPath ?? null,
                  existingWidth: draft.image.existingWidth ?? null,
                  existingHeight: draft.image.existingHeight ?? null,
                  remove: Boolean(draft.image.remove),
              }
            : null,
    }
}

export function buildCommunityPostUrl(postId: string) {
    return `/community/${postId}`
}

export function getCommunityImageExtension(file: File) {
    switch (file.type) {
        case 'image/png':
            return 'png'
        case 'image/webp':
            return 'webp'
        default:
            return 'jpg'
    }
}

export function validateCommunityImageFile(file: File) {
    if (!COMMUNITY_ALLOWED_IMAGE_TYPES.has(file.type)) {
        return 'Only JPEG, PNG, and WEBP images are supported.'
    }

    if (file.size > COMMUNITY_IMAGE_MAX_SIZE_BYTES) {
        return 'Images must be smaller than 5MB.'
    }

    return null
}

export function buildCommunityImageStoragePath({
    userId,
    postId,
    extension,
}: {
    userId: string
    postId: string
    extension: string
}) {
    return `community/${userId}/${postId}/hero-${Date.now()}.${extension}`
}

export function isManagedCommunityImagePath(path: string, userId?: string | null) {
    if (!path || !userId) return false
    return path.startsWith(`community/${userId}/`)
}

export function matchesTickerFilter(post: CommunityPost, ticker?: string | null) {
    if (!ticker) return true
    const normalizedTicker = normalizeTicker(ticker)
    return post.tickers.includes(normalizedTicker)
}

export function formatCommunityTimestamp(dateString: string) {
    const target = new Date(dateString).getTime()
    const deltaMs = target - Date.now()
    const deltaSeconds = Math.round(deltaMs / 1000)
    const formatter = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })

    const ranges: Array<[Intl.RelativeTimeFormatUnit, number]> = [
        ['year', 60 * 60 * 24 * 365],
        ['month', 60 * 60 * 24 * 30],
        ['week', 60 * 60 * 24 * 7],
        ['day', 60 * 60 * 24],
        ['hour', 60 * 60],
        ['minute', 60],
    ]

    for (const [unit, seconds] of ranges) {
        if (Math.abs(deltaSeconds) >= seconds) {
            return formatter.format(Math.round(deltaSeconds / seconds), unit)
        }
    }

    return formatter.format(deltaSeconds, 'second')
}

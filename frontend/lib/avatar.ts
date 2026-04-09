interface ResolveAvatarParams {
    photoURL?: string | null
    name?: string | null
    email?: string | null
}

const AVATAR_GRADIENTS: Array<[string, string]> = [
    ['#0EA5E9', '#2563EB'],
    ['#14B8A6', '#0F766E'],
    ['#F97316', '#EA580C'],
    ['#A855F7', '#7E22CE'],
    ['#EC4899', '#BE185D'],
    ['#84CC16', '#4D7C0F'],
    ['#F59E0B', '#D97706'],
    ['#3B82F6', '#1D4ED8'],
]

function hashString(input: string): number {
    let hash = 0
    for (let i = 0; i < input.length; i += 1) {
        hash = (hash << 5) - hash + input.charCodeAt(i)
        hash |= 0
    }
    return Math.abs(hash)
}

function getNormalizedSeed(name?: string | null, email?: string | null): string {
    const source = (name || email || 'user').trim().toLowerCase()
    return source || 'user'
}

function sanitizeInitials(value: string): string {
    const cleaned = value.replace(/[^a-z0-9]/gi, '').toUpperCase()
    if (cleaned.length >= 2) return cleaned.slice(0, 2)
    if (cleaned.length === 1) return cleaned
    return 'U'
}

function extractInitials(name?: string | null, email?: string | null): string {
    const source = (name || email || 'user').trim()
    if (!source) return 'U'

    const namePart = source.includes('@') ? source.split('@')[0] : source
    const tokens = namePart.split(/[\s._-]+/).filter(Boolean)

    if (tokens.length === 0) return 'U'
    if (tokens.length === 1) {
        return sanitizeInitials(tokens[0].slice(0, 2))
    }

    return sanitizeInitials(`${tokens[0][0]}${tokens[1][0]}`)
}

export function createDefaultAvatarDataUrl(
    name?: string | null,
    email?: string | null
): string {
    const seed = getNormalizedSeed(name, email)
    const gradientIndex = hashString(seed) % AVATAR_GRADIENTS.length
    const [startColor, endColor] = AVATAR_GRADIENTS[gradientIndex]
    const initials = extractInitials(name, email)
    const gradientId = `grad-${gradientIndex}`

    const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">
  <defs>
    <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${startColor}" />
      <stop offset="100%" stop-color="${endColor}" />
    </linearGradient>
  </defs>
  <rect width="128" height="128" rx="64" fill="url(#${gradientId})" />
  <text x="50%" y="54%" fill="#FFFFFF" font-family="Inter, Arial, sans-serif" font-size="44" font-weight="700" text-anchor="middle" dominant-baseline="middle">${initials}</text>
</svg>`

    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

export function resolveAvatarUrl({
    photoURL,
    name,
    email,
}: ResolveAvatarParams): string {
    if (photoURL && photoURL.trim()) {
        return photoURL
    }

    return createDefaultAvatarDataUrl(name, email)
}

import Link from 'next/link'
import { AlertCircle, Bookmark, LockKeyhole, Newspaper, UserCircle2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardTitle } from '@/components/ui/card'

export type CommunityEmptyStateVariant =
    | 'all-empty'
    | 'saved-empty'
    | 'mine-empty'
    | 'auth-required'
    | 'error'
    | 'post-not-found'

interface CommunityEmptyStateProps {
    variant: CommunityEmptyStateVariant
    ticker?: string | null
    requiresAuth?: boolean
    onRetry?: () => void
}

const copyByVariant: Record<
    CommunityEmptyStateVariant,
    {
        icon: typeof Newspaper
        title: string
        description: string
        accentColor: string
    }
> = {
    'all-empty': {
        icon: Newspaper,
        title: 'No notes in the channel yet',
        description: 'The feed is ready. It just needs the first setup, chart, or conviction note.',
        accentColor: 'from-blue-500 to-cyan-400',
    },
    'saved-empty': {
        icon: Bookmark,
        title: 'No saved posts yet',
        description: 'As you save sharp ideas, they will build a personal review lane here.',
        accentColor: 'from-amber-500 to-orange-400',
    },
    'mine-empty': {
        icon: UserCircle2,
        title: 'Your archive is still empty',
        description: 'Publish the first post and your own trail will start to form here.',
        accentColor: 'from-emerald-500 to-teal-400',
    },
    'auth-required': {
        icon: LockKeyhole,
        title: 'Sign in required',
        description: 'Saved and Mine are personal views, so they only appear in an authenticated session.',
        accentColor: 'from-violet-500 to-purple-400',
    },
    error: {
        icon: AlertCircle,
        title: 'Unable to load community posts',
        description: 'Try again in a moment. The feed could not be loaded right now.',
        accentColor: 'from-rose-500 to-pink-400',
    },
    'post-not-found': {
        icon: AlertCircle,
        title: 'Post not found',
        description: 'The link may be stale, or the original post may have been deleted.',
        accentColor: 'from-rose-500 to-pink-400',
    },
}

export function CommunityEmptyState({
    variant,
    ticker,
    requiresAuth = false,
    onRetry,
}: CommunityEmptyStateProps) {
    const copy = copyByVariant[variant]
    const Icon = copy.icon
    const description =
        ticker && variant !== 'auth-required'
            ? `${copy.description} Active ticker filter: ${ticker}.`
            : copy.description

    return (
        <Card className="animate-fade-in-up overflow-hidden rounded-2xl border-white/[0.06] bg-gradient-to-b from-white/[0.04] to-white/[0.01] py-0">
            <CardContent className="relative flex flex-col items-center gap-5 overflow-hidden px-6 py-14 text-center">
                {/* Animated background blobs */}
                <div className="pointer-events-none absolute inset-0">
                    <div className="animate-blob absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary/[0.06] blur-3xl" />
                    <div className="animate-blob animation-delay-2000 absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-purple-500/[0.06] blur-3xl" />
                </div>

                {/* Dot pattern */}
                <div
                    className="pointer-events-none absolute inset-0 opacity-[0.025]"
                    style={{
                        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)',
                        backgroundSize: '20px 20px',
                    }}
                />

                {/* Floating icon */}
                <div className="relative">
                    <div className={`animate-float flex size-16 items-center justify-center rounded-2xl bg-gradient-to-br ${copy.accentColor} shadow-lg`}>
                        <Icon className="size-7 text-white" />
                    </div>
                    {/* Glow below icon */}
                    <div className={`absolute -bottom-2 left-1/2 h-6 w-12 -translate-x-1/2 rounded-full bg-gradient-to-r ${copy.accentColor} opacity-20 blur-xl`} />
                </div>

                <div className="relative space-y-2">
                    <CardTitle className="text-xl font-bold tracking-tight">{copy.title}</CardTitle>
                    <CardDescription className="mx-auto max-w-md text-sm leading-6">
                        {description}
                    </CardDescription>
                </div>

                <div className="relative flex flex-wrap items-center justify-center gap-2">
                    {variant === 'auth-required' || requiresAuth ? (
                        <Button asChild size="sm" className="rounded-xl shadow-[0_4px_16px_-4px_rgba(40,98,255,0.5)]">
                            <Link href="/login">Sign in</Link>
                        </Button>
                    ) : null}
                    {variant === 'error' && onRetry ? (
                        <Button variant="outline" size="sm" className="rounded-xl" onClick={onRetry}>
                            Try again
                        </Button>
                    ) : null}
                    {variant === 'post-not-found' ? (
                        <Button asChild variant="outline" size="sm" className="rounded-xl">
                            <Link href="/community">Back to feed</Link>
                        </Button>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    )
}

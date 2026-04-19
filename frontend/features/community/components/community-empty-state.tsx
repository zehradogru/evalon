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
    }
> = {
    'all-empty': {
        icon: Newspaper,
        title: 'No notes in the channel yet',
        description: 'The feed is ready. It just needs the first setup, chart, or conviction note.',
    },
    'saved-empty': {
        icon: Bookmark,
        title: 'No saved posts yet',
        description: 'As you save sharp ideas, they will build a personal review lane here.',
    },
    'mine-empty': {
        icon: UserCircle2,
        title: 'Your archive is still empty',
        description: 'Publish the first post and your own trail will start to form here.',
    },
    'auth-required': {
        icon: LockKeyhole,
        title: 'Sign in required',
        description: 'Saved and Mine are personal views, so they only appear in an authenticated session.',
    },
    error: {
        icon: AlertCircle,
        title: 'Unable to load community posts',
        description: 'Try again in a moment. The feed could not be loaded right now.',
    },
    'post-not-found': {
        icon: AlertCircle,
        title: 'Post not found',
        description: 'The link may be stale, or the original post may have been deleted.',
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
        <Card className="overflow-hidden rounded-[2rem] border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.02))] py-0">
            <CardContent className="relative flex flex-col items-start gap-5 overflow-hidden px-6 py-10">
                <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle_at_center,rgba(40,98,255,0.12),transparent_58%)]" />
                <div className="relative flex size-14 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                    <Icon className="size-6" />
                </div>
                <div className="relative space-y-2">
                    <CardTitle className="text-xl tracking-tight">{copy.title}</CardTitle>
                    <CardDescription className="max-w-xl text-sm leading-6">
                        {description}
                    </CardDescription>
                </div>
                <div className="relative flex flex-wrap items-center gap-2">
                    {variant === 'auth-required' || requiresAuth ? (
                        <Button asChild size="sm">
                            <Link href="/login">Sign in</Link>
                        </Button>
                    ) : null}
                    {variant === 'error' && onRetry ? (
                        <Button variant="outline" size="sm" onClick={onRetry}>
                            Try again
                        </Button>
                    ) : null}
                    {variant === 'post-not-found' ? (
                        <Button asChild variant="outline" size="sm">
                            <Link href="/community">Back to feed</Link>
                        </Button>
                    ) : null}
                </div>
            </CardContent>
        </Card>
    )
}

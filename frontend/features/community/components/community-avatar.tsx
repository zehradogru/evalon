'use client'

import { cn } from '@/lib/utils'

const AVATAR_GRADIENTS = [
    'from-blue-500 to-cyan-400',
    'from-violet-500 to-fuchsia-400',
    'from-emerald-500 to-teal-400',
    'from-amber-500 to-orange-400',
    'from-rose-500 to-pink-400',
    'from-indigo-500 to-blue-400',
]

function avatarGradient(name: string) {
    const charCode = name.charCodeAt(0) || 0
    return AVATAR_GRADIENTS[charCode % AVATAR_GRADIENTS.length]
}

interface CommunityAvatarProps {
    name: string
    size?: 'sm' | 'md'
    className?: string
    showStatus?: boolean
}

export function CommunityAvatar({
    name,
    size = 'md',
    className,
    showStatus = false,
}: CommunityAvatarProps) {
    const initial = name.slice(0, 1).toUpperCase()

    return (
        <div className={cn('relative shrink-0', className)}>
            <div
                className={cn(
                    'flex items-center justify-center rounded-full bg-gradient-to-br font-bold text-white shadow-lg',
                    avatarGradient(name),
                    size === 'sm' ? 'size-8 text-xs' : 'size-10 text-sm'
                )}
            >
                {initial}
            </div>
            {showStatus ? (
                <div
                    className={cn(
                        'absolute rounded-full border-2 border-black bg-emerald-400',
                        size === 'sm'
                            ? '-right-0.5 -bottom-0.5 size-2.5'
                            : '-right-0.5 -bottom-0.5 size-3'
                    )}
                />
            ) : null}
        </div>
    )
}

'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store'
import { Loader2 } from 'lucide-react'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const { isAuthenticated, loading, requiresEmailVerification } = useAuthStore()

    useEffect(() => {
        if (loading) {
            return
        }

        if (!isAuthenticated) {
            router.replace('/login')
            return
        }

        if (requiresEmailVerification) {
            router.replace('/verify-email')
        }
    }, [isAuthenticated, loading, requiresEmailVerification, router])

    if (loading || !isAuthenticated || requiresEmailVerification) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#131722]">
                <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
            </div>
        )
    }

    return <>{children}</>
}

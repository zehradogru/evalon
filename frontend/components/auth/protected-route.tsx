'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const router = useRouter()
    const { isAuthenticated, loading } = useAuthStore()

    useEffect(() => {
        // Redirect to login if not authenticated and not loading
        if (!loading && !isAuthenticated) {
            router.push('/login')
        }
    }, [isAuthenticated, loading, router])

    // Show loading while checking auth
    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#131722]">
                <div className="text-slate-400">Loading...</div>
            </div>
        )
    }

    // Only render children if authenticated
    if (!isAuthenticated) {
        return null
    }

    return <>{children}</>
}

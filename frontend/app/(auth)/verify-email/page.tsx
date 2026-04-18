'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store'
import { Loader2, MailCheck } from 'lucide-react'

export default function VerifyEmailPage() {
    const router = useRouter()
    const { isAuthenticated, loading, login, user, requiresEmailVerification } =
        useAuthStore()

    const [error, setError] = useState('')
    const [success, setSuccess] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const [sending, setSending] = useState(false)

    useEffect(() => {
        if (!loading && isAuthenticated && !requiresEmailVerification) {
            router.replace('/')
        }
    }, [isAuthenticated, loading, requiresEmailVerification, router])

    const handleRefresh = async () => {
        setError('')
        setSuccess('')
        setRefreshing(true)

        try {
            const result = await authService.refreshCurrentUser()

            if (!result) {
                router.replace('/login')
                return
            }

            login(result.user)

            if (!result.requiresEmailVerification) {
                setSuccess('Your email has been verified. Redirecting...')
                router.replace('/')
                return
            }

            setError(
                'Your email is not verified yet. Open the link in your inbox and try again.'
            )
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not refresh your verification status.'
            )
        } finally {
            setRefreshing(false)
        }
    }

    const handleResend = async () => {
        setError('')
        setSuccess('')
        setSending(true)

        try {
            await authService.resendVerificationEmail()
            setSuccess('A new verification email has been sent.')
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Could not send a new verification email.'
            )
        } finally {
            setSending(false)
        }
    }

    const handleUseAnotherAccount = async () => {
        await authService.logout()
        router.replace('/signup')
    }

    if (loading || (isAuthenticated && !requiresEmailVerification)) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#0f172a]">
                <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
            </div>
        )
    }

    if (!isAuthenticated || !user) {
        return (
            <div className="relative flex min-h-screen items-center justify-center p-4">
                <div className="absolute inset-0 bg-[url('/images/backgrounds/auth-bg.png')] bg-cover bg-center bg-no-repeat">
                    <div className="absolute inset-0 bg-black/40" />
                </div>

                <Card className="relative z-10 w-full max-w-md border-slate-600/30 bg-slate-900/70 p-8 text-center backdrop-blur-2xl">
                    <h1 className="text-2xl font-semibold text-white">
                        Sign in to verify your email
                    </h1>
                    <p className="mt-3 text-sm text-slate-300">
                        You need an active session to resend or confirm your verification email.
                    </p>
                    <div className="mt-6 flex flex-col gap-3">
                        <Link href="/login">
                            <Button className="w-full bg-blue-600 hover:bg-blue-700">
                                Go to Login
                            </Button>
                        </Link>
                        <Link href="/signup">
                            <Button
                                variant="outline"
                                className="w-full border-slate-600 bg-transparent text-white hover:bg-slate-800"
                            >
                                Create a new account
                            </Button>
                        </Link>
                    </div>
                </Card>
            </div>
        )
    }

    return (
        <div className="relative flex min-h-screen items-center justify-center p-4">
            <div className="absolute inset-0 bg-[url('/images/backgrounds/auth-bg.png')] bg-cover bg-center bg-no-repeat">
                <div className="absolute inset-0 bg-black/45" />
            </div>

            <Card className="relative z-10 w-full max-w-xl border-slate-600/30 bg-slate-900/75 p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)] backdrop-blur-2xl">
                <div className="space-y-6">
                    <div className="space-y-3 text-center">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-blue-500/10 text-blue-300">
                            <MailCheck className="h-7 w-7" />
                        </div>
                        <h1 className="text-2xl font-semibold text-white">
                            Verify your email address
                        </h1>
                        <p className="text-sm text-slate-300">
                            We sent a verification link to{' '}
                            <span className="font-medium text-white">{user.email}</span>.
                            Open the email, click the link, then return here to continue.
                        </p>
                    </div>

                    {(error || success) && (
                        <div
                            className={`rounded-lg border p-3 text-sm ${
                                error
                                    ? 'border-red-500/20 bg-red-500/10 text-red-300'
                                    : 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300'
                            }`}
                        >
                            {error || success}
                        </div>
                    )}

                    <div className="grid gap-3 sm:grid-cols-2">
                        <Button
                            onClick={handleRefresh}
                            disabled={refreshing || sending}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {refreshing ? 'Checking...' : "I've verified my email"}
                        </Button>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleResend}
                            disabled={refreshing || sending}
                            className="border-slate-600 bg-transparent text-white hover:bg-slate-800"
                        >
                            {sending ? 'Sending...' : 'Resend verification email'}
                        </Button>
                    </div>

                    <div className="flex flex-col items-center gap-3 border-t border-slate-700/80 pt-5 text-sm text-slate-400">
                        <button
                            type="button"
                            onClick={handleUseAnotherAccount}
                            className="font-medium text-slate-200 hover:text-white"
                        >
                            Use a different account
                        </button>
                        <Link href="/login" className="hover:text-white">
                            Back to login
                        </Link>
                    </div>
                </div>
            </Card>
        </div>
    )
}

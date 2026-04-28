'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store'
import { AUTH_BG_BLUR_URL } from '@/lib/constants'

export default function LoginPage() {
    const router = useRouter()
    const { login } = useAuthStore()
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            const { user, requiresEmailVerification } = await authService.login({
                email,
                password,
            })
            login(user)
            router.push(requiresEmailVerification ? '/verify-email' : '/')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Login failed')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleLogin = async () => {
        setError('')
        setLoading(true)

        try {
            const { user, requiresEmailVerification } =
                await authService.loginWithGoogle()
            login(user)
            router.push(requiresEmailVerification ? '/verify-email' : '/')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Google login failed')
        } finally {
            setLoading(false)
        }
    }

    const handleAppleLogin = async () => {
        setError('')
        setLoading(true)

        try {
            const { user, requiresEmailVerification } =
                await authService.loginWithApple()
            login(user)
            router.push(requiresEmailVerification ? '/verify-email' : '/')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Apple login failed')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative flex min-h-screen items-center justify-center p-4">
            {/* Background Image */}
            <div className="absolute inset-0 z-0">
                <Image
                    src="/images/backgrounds/auth-bg.webp"
                    alt=""
                    fill
                    priority
                    quality={85}
                    className="object-cover object-center"
                    placeholder="blur"
                    blurDataURL={AUTH_BG_BLUR_URL}
                />
                <div className="absolute inset-0 bg-black/40" />
            </div>

            <div className="relative z-10 w-full max-w-md space-y-6">
                {/* Login Card */}
                <Card className="border-slate-600/30 bg-slate-900/70 backdrop-blur-2xl p-8 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                    <div className="space-y-6">
                        {/* Header */}
                        <div className="text-center">
                            <h1 className="text-2xl font-semibold text-white/95">
                                Welcome back
                            </h1>
                            <p className="mt-2 text-sm text-slate-300">
                                Log in to manage your portfolio
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-200 text-sm font-medium">
                                    Email address
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="john@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    required
                                    className="border-slate-500/30 bg-slate-800/30 backdrop-blur-sm text-white placeholder:text-slate-400 focus:border-blue-500/50 transition-colors"
                                />
                            </div>

                            {/* Password */}
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-slate-200 text-sm font-medium">
                                        Password
                                    </Label>
                                    <Link
                                        href="/forgot-password"
                                        className="text-sm text-blue-500 hover:text-blue-400"
                                    >
                                        Forgot password?
                                    </Link>
                                </div>
                                <Input
                                    id="password"
                                    type="password"
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    autoComplete="current-password"
                                    required
                                    className="border-slate-500/30 bg-slate-800/30 backdrop-blur-sm text-white placeholder:text-slate-400 focus:border-blue-500/50 transition-colors"
                                />
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="rounded-md bg-red-500/10 p-3 text-sm text-red-400">
                                    {error}
                                </div>
                            )}

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 hover:bg-blue-700"
                            >
                                {loading ? 'Logging in...' : 'Log In'}
                            </Button>

                            {/* Divider */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-500/30"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="bg-slate-900/70 px-3 text-slate-300 backdrop-blur-sm">
                                        OR CONTINUE WITH
                                    </span>
                                </div>
                            </div>

                            {/* Google OAuth */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleGoogleLogin}
                                disabled={loading}
                                className="w-full border-slate-600 bg-transparent text-white hover:bg-slate-700"
                            >
                                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                                    <path
                                        fill="currentColor"
                                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                                    />
                                    <path
                                        fill="currentColor"
                                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                                    />
                                </svg>
                                Google
                            </Button>

                            {/* Apple OAuth - Requires Apple Developer Account */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleAppleLogin}
                                disabled={true}
                                className="w-full border-slate-600 bg-transparent text-white hover:bg-slate-700 opacity-50 cursor-not-allowed"
                                title="Apple Sign-In requires Apple Developer configuration"
                            >
                                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                                </svg>
                                Apple
                            </Button>
                        </form>

                        {/* Signup Link */}
                        <div className="text-center text-sm">
                            <span className="text-slate-400">
                                Don&apos;t have an account?{' '}
                            </span>
                            <Link
                                href="/signup"
                                className="font-semibold text-blue-500 hover:text-blue-400"
                            >
                                Create an account
                            </Link>
                        </div>
                    </div>
                </Card>

                {/* Footer Links */}
                <div className="flex justify-center space-x-6 text-xs text-slate-500">
                    <Link href="/privacy" className="hover:text-slate-400">
                        Privacy Policy
                    </Link>
                    <Link href="/terms" className="hover:text-slate-400">
                        Terms of Service
                    </Link>
                    <Link href="/help" className="hover:text-slate-400">
                        Help Center
                    </Link>
                </div>
            </div>
        </div>
    )
}

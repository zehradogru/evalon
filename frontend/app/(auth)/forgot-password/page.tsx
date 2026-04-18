'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { authService } from '@/services/auth.service'

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('')
    const [error, setError] = useState('')
    const [success, setSuccess] = useState(false)
    const [loading, setLoading] = useState(false)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')
        setLoading(true)

        try {
            await authService.sendPasswordReset(email)
            setSuccess(true)
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : 'Failed to send reset email. Please try again.'
            )
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="relative flex min-h-screen items-center justify-center p-4">
            {/* Background Image */}
            <div 
                className="absolute inset-0 z-0" 
                style={{
                    backgroundImage: 'url(/images/backgrounds/auth-bg.png)',
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    backgroundRepeat: 'no-repeat',
                }}
            >
                <div className="absolute inset-0 bg-black/40" />
            </div>
            
            <Card className="relative z-10 w-full max-w-md border-slate-600/30 bg-slate-900/70 backdrop-blur-2xl shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                <CardHeader>
                    <CardTitle className="text-2xl text-white">Reset Password</CardTitle>
                    <CardDescription className="text-slate-400">
                        Enter your email to receive a password reset link
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {success ? (
                        <div className="space-y-4 text-center">
                            <div className="rounded-lg bg-green-900/20 p-4 text-green-400">
                                <p className="font-medium">Check your email!</p>
                                <p className="mt-2 text-sm">
                                    If an account exists for this email, a password reset link has been sent.
                                </p>
                            </div>
                            <Link href="/login">
                                <Button variant="outline" className="w-full">
                                    Back to Login
                                </Button>
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="space-y-4">
                            {error && (
                                <div className="rounded-lg bg-red-900/20 p-3 text-sm text-red-400">
                                    {error}
                                </div>
                            )}

                            <div className="space-y-2">
                                <Label htmlFor="email">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    autoComplete="email"
                                    required
                                    disabled={loading}
                                    className="bg-slate-800 text-white"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full"
                                disabled={loading}
                            >
                                {loading ? 'Sending...' : 'Send Reset Link'}
                            </Button>

                            <div className="text-center">
                                <Link
                                    href="/login"
                                    className="text-sm text-slate-400 hover:text-white"
                                >
                                    ← Back to Login
                                </Link>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}

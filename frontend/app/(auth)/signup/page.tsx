'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { authService } from '@/services/auth.service'
import { useAuthStore } from '@/store'
import {
    getPasswordPolicyState,
    isPasswordPolicySatisfied,
    isValidEmail,
    normalizeDisplayName,
    PASSWORD_MIN_LENGTH,
} from '@/lib/auth-utils'
import { AUTH_BG_BLUR_URL } from '@/lib/constants'
import { CheckCircle2, Circle } from 'lucide-react'

export default function SignupPage() {
    const router = useRouter()
    const { login } = useAuthStore()
    const [name, setName] = useState('')
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [confirmPassword, setConfirmPassword] = useState('')
    const [agreedToTerms, setAgreedToTerms] = useState(false)
    const [agreedToPrivacy, setAgreedToPrivacy] = useState(false)
    const [emailError, setEmailError] = useState('')
    const [error, setError] = useState('')
    const [loading, setLoading] = useState(false)
    const passwordPolicy = getPasswordPolicyState(password)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        setError('')

        const normalizedName = normalizeDisplayName(name)

        if (!normalizedName) {
            setError('Enter your full name to continue')
            return
        }

        if (!isValidEmail(email)) {
            setError('Enter a valid email address')
            return
        }

        if (!agreedToTerms) {
            setError('You must agree to the Terms of Service')
            return
        }

        if (!agreedToPrivacy) {
            setError('You must agree to the Privacy Policy')
            return
        }

        if (!isPasswordPolicySatisfied(password)) {
            setError(
                `Password must be at least ${PASSWORD_MIN_LENGTH} characters and include uppercase, lowercase, and a number`
            )
            return
        }

        if (password !== confirmPassword) {
            setError('Passwords do not match')
            return
        }

        setLoading(true)

        try {
            const { user, requiresEmailVerification } = await authService.signup({
                email,
                password,
                name: normalizedName,
            })
            login(user)
            router.push(requiresEmailVerification ? '/verify-email' : '/')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Signup failed')
        } finally {
            setLoading(false)
        }
    }

    const handleGoogleSignup = async () => {
        setError('')
        setLoading(true)

        try {
            const { user, requiresEmailVerification } =
                await authService.loginWithGoogle()
            login(user)
            router.push(requiresEmailVerification ? '/verify-email' : '/')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Google signup failed')
        } finally {
            setLoading(false)
        }
    }

    const handleAppleSignup = async () => {
        setError('')
        setLoading(true)

        try {
            const { user, requiresEmailVerification } =
                await authService.loginWithApple()
            login(user)
            router.push(requiresEmailVerification ? '/verify-email' : '/')
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Apple signup failed')
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
                {/* Signup Card */}
                <Card className="border-slate-600/30 bg-slate-900/70 backdrop-blur-2xl p-7 shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]">
                    <div className="space-y-5">
                        {/* Header */}
                        <div className="text-center">
                            <h1 className="text-2xl font-semibold text-white/95">
                                Create your account
                            </h1>
                            <p className="mt-1.5 text-sm text-slate-300">
                                Start tracking your portfolio like a pro.
                            </p>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="space-y-3">
                            {/* Name */}
                            <div className="space-y-2">
                                <Label htmlFor="name" className="text-slate-200 text-sm font-medium">
                                    Full Name
                                </Label>
                                <Input
                                    id="name"
                                    type="text"
                                    placeholder="John Doe"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    autoComplete="name"
                                    required
                                    className="border-slate-500/30 bg-slate-800/30 backdrop-blur-sm text-white placeholder:text-slate-400 focus:border-blue-500/50 transition-colors"
                                />
                            </div>

                            {/* Email */}
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-slate-200 text-sm font-medium">
                                    Email Address
                                </Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="name@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    onFocus={() => setEmailError('')}
                                    onBlur={() => {
                                        if (email && !isValidEmail(email)) {
                                            setEmailError('Enter a valid email address')
                                        }
                                    }}
                                    autoComplete="email"
                                    required
                                    className={`border-slate-500/30 bg-slate-800/30 backdrop-blur-sm placeholder:text-slate-400 focus:border-blue-500/50 transition-colors ${emailError ? 'text-red-400' : 'text-white'}`}
                                />
                            </div>

                            {/* Password + Confirm side by side */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <Label htmlFor="password" className="text-slate-200 text-sm font-medium">
                                        Password
                                    </Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        placeholder={`Min ${PASSWORD_MIN_LENGTH} chars`}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        autoComplete="new-password"
                                        required
                                        minLength={PASSWORD_MIN_LENGTH}
                                        className="border-slate-500/30 bg-slate-800/30 backdrop-blur-sm text-white placeholder:text-slate-400 focus:border-blue-500/50 transition-colors"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="confirmPassword" className="text-slate-200 text-sm font-medium">
                                        Confirm Password
                                    </Label>
                                    <Input
                                        id="confirmPassword"
                                        type="password"
                                        placeholder="Re-enter password"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                        autoComplete="new-password"
                                        required
                                        className={`border-slate-500/30 bg-slate-800/30 backdrop-blur-sm text-white placeholder:text-slate-400 focus:border-blue-500/50 transition-colors ${
                                            confirmPassword && confirmPassword !== password
                                                ? 'border-red-500/50'
                                                : confirmPassword && confirmPassword === password
                                                  ? 'border-emerald-500/50'
                                                  : ''
                                        }`}
                                    />
                                </div>
                            </div>
                            <div className="space-y-1.5 rounded-lg border border-slate-700/80 bg-slate-950/40 p-3">
                                <PasswordChecklistItem
                                    complete={passwordPolicy.hasMinimumLength}
                                    label={`At least ${PASSWORD_MIN_LENGTH} characters`}
                                />
                                <PasswordChecklistItem
                                    complete={passwordPolicy.hasUppercase}
                                    label="At least one uppercase letter"
                                />
                                <PasswordChecklistItem
                                    complete={passwordPolicy.hasLowercase}
                                    label="At least one lowercase letter"
                                />
                                <PasswordChecklistItem
                                    complete={passwordPolicy.hasNumeric}
                                    label="At least one number"
                                />
                                {confirmPassword && (
                                    <PasswordChecklistItem
                                        complete={password === confirmPassword}
                                        label="Passwords match"
                                    />
                                )}
                            </div>

                            {/* IMPROVED: Separate Terms Checkboxes */}
                            <div className="space-y-2 rounded-lg border border-slate-700 bg-[#1a1f2e] p-3">
                                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                                    Required Agreements
                                </p>

                                {/* Terms of Service */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox
                                        id="terms"
                                        checked={agreedToTerms}
                                        onCheckedChange={(checked) =>
                                            setAgreedToTerms(checked as boolean)
                                        }
                                        className="h-5 w-5 rounded border-2 border-slate-500 data-[state=checked]:border-blue-500 data-[state=checked]:bg-blue-600"
                                    />
                                    <Label
                                        htmlFor="terms"
                                        className="flex-1 cursor-pointer text-sm text-slate-300 hover:text-white"
                                    >
                                        I agree to the{' '}
                                        <Link
                                            href="/terms"
                                            className="font-semibold text-blue-400 underline-offset-2 hover:text-blue-300 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Terms of Service
                                        </Link>
                                    </Label>
                                </div>

                                {/* Privacy Policy */}
                                <div className="flex items-center space-x-3">
                                    <Checkbox
                                        id="privacy"
                                        checked={agreedToPrivacy}
                                        onCheckedChange={(checked) =>
                                            setAgreedToPrivacy(checked as boolean)
                                        }
                                        className="h-5 w-5 rounded border-2 border-slate-500 data-[state=checked]:border-green-500 data-[state=checked]:bg-green-600"
                                    />
                                    <Label
                                        htmlFor="privacy"
                                        className="flex-1 cursor-pointer text-sm text-slate-300 hover:text-white"
                                    >
                                        I agree to the{' '}
                                        <Link
                                            href="/privacy"
                                            className="font-semibold text-green-400 underline-offset-2 hover:text-green-300 hover:underline"
                                            onClick={(e) => e.stopPropagation()}
                                        >
                                            Privacy Policy
                                        </Link>
                                    </Label>
                                </div>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div className="rounded-md bg-red-500/10 border border-red-500/20 p-3 text-sm text-red-400">
                                    {error}
                                </div>
                            )}

                            {/* Submit */}
                            <Button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-blue-600 text-base font-semibold hover:bg-blue-700"
                            >
                                {loading ? 'Creating account...' : 'Sign Up'}
                            </Button>

                            {/* Divider */}
                            <div className="relative">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-slate-600"></div>
                                </div>
                                <div className="relative flex justify-center text-sm">
                                    <span className="bg-[#212633] px-2 text-slate-400">OR</span>
                                </div>
                            </div>

                            {/* Google OAuth */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleGoogleSignup}
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
                                Continue with Google
                            </Button>

                            {/* Apple OAuth - Requires Apple Developer Account */}
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleAppleSignup}
                                disabled={true}
                                className="w-full border-slate-600 bg-transparent text-white hover:bg-slate-700 opacity-50 cursor-not-allowed"
                                title="Apple Sign-In requires Apple Developer configuration"
                            >
                                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                                </svg>
                                Continue with Apple
                            </Button>
                        </form>

                        {/* Login Link */}
                        <div className="text-center text-sm">
                            <span className="text-slate-400">Already have an account? </span>
                            <Link
                                href="/login"
                                className="font-semibold text-blue-500 hover:text-blue-400"
                            >
                                Log In
                            </Link>
                        </div>
                    </div>
                </Card>

                {/* Footer */}
                <div className="text-center text-xs text-slate-500">
                    <p>Secure sign-up with Firebase Authentication</p>
                </div>
            </div>
        </div>
    )
}

function PasswordChecklistItem({
    complete,
    label,
}: {
    complete: boolean
    label: string
}) {
    return (
        <div
            className={`flex items-center gap-2 text-xs ${
                complete ? 'text-emerald-300' : 'text-slate-400'
            }`}
        >
            {complete ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
            ) : (
                <Circle className="h-3.5 w-3.5" />
            )}
            <span>{label}</span>
        </div>
    )
}

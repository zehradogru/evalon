import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function HelpPage() {
    return (
        <div className="min-h-screen bg-[#131722] p-8">
            <div className="mx-auto max-w-6xl">
                <div className="mb-8">
                    <Link href="/login">
                        <Button variant="ghost" className="text-slate-400 hover:text-white">
                            ← Back
                        </Button>
                    </Link>
                </div>

                <div className="mb-12 text-center">
                    <h1 className="text-4xl font-bold text-white">Help Center</h1>
                    <p className="mt-2 text-slate-400">Find answers to common questions</p>
                </div>

                <div className="grid gap-6 md:grid-cols-2">
                    {/* Getting Started */}
                    <Card className="border-slate-800 bg-slate-900">
                        <CardHeader>
                            <CardTitle className="text-white">🚀 Getting Started</CardTitle>
                            <CardDescription>Learn the basics</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-slate-300">
                            <div>
                                <h3 className="font-semibold text-white">How do I create an account?</h3>
                                <p className="text-sm">
                                    Click &quot;Sign Up&quot; and choose between email/password or social login (Google, Apple).
                                </p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">How do I reset my password?</h3>
                                <p className="text-sm">
                                    On the login page, click &quot;Forgot Password?&quot; and follow the instructions sent to your email.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Is EVALON Web free?</h3>
                                <p className="text-sm">
                                    Yes, the basic features are free. Additional premium features may be added in the future.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Account & Security */}
                    <Card className="border-slate-800 bg-slate-900">
                        <CardHeader>
                            <CardTitle className="text-white">🔐 Account & Security</CardTitle>
                            <CardDescription>Protect your account</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-slate-300">
                            <div>
                                <h3 className="font-semibold text-white">Is my data secure?</h3>
                                <p className="text-sm">
                                    Yes. We use Firebase Authentication with enterprise-grade security and encryption.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Can I change my email?</h3>
                                <p className="text-sm">
                                    Visit Settings → Account to update your email address.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">How do I delete my account?</h3>
                                <p className="text-sm">
                                    Go to Settings → Account → Delete Account. This action is permanent.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Trading & Markets */}
                    <Card className="border-slate-800 bg-slate-900">
                        <CardHeader>
                            <CardTitle className="text-white">📊 Trading & Markets</CardTitle>
                            <CardDescription>Market data questions</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-slate-300">
                            <div>
                                <h3 className="font-semibold text-white">What markets are supported?</h3>
                                <p className="text-sm">
                                    Currently: BIST (Turkey), NASDAQ, Forex, and Cryptocurrencies.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Is the data real-time?</h3>
                                <p className="text-sm">
                                    Data refresh intervals vary by market. Most data is delayed by 15-20 minutes.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Can I execute trades?</h3>
                                <p className="text-sm">
                                    EVALON Web is currently view-only. Trading integration may be added in the future.
                                </p>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Technical Support */}
                    <Card className="border-slate-800 bg-slate-900">
                        <CardHeader>
                            <CardTitle className="text-white">🛠️ Technical Support</CardTitle>
                            <CardDescription>Troubleshooting</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4 text-slate-300">
                            <div>
                                <h3 className="font-semibold text-white">The page won&apos;t load</h3>
                                <p className="text-sm">
                                    Try refreshing the page (Cmd/Ctrl + R) or clearing your browser cache.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">I&apos;m getting authentication errors</h3>
                                <p className="text-sm">
                                    Log out completely and log back in. If the issue persists, reset your password.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-semibold text-white">Browser compatibility</h3>
                                <p className="text-sm">
                                    We support the latest versions of Chrome, Firefox, Safari, and Edge.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Contact Section */}
                <Card className="mt-8 border-slate-800 bg-gradient-to-br from-blue-900/20 to-slate-900">
                    <CardHeader>
                        <CardTitle className="text-white">Still need help?</CardTitle>
                        <CardDescription>We&apos;re here to assist you</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <p className="text-slate-300">
                            If you couldn&apos;t find the answer you&apos;re looking for, please reach out to our support team.
                        </p>
                        <div className="flex gap-4">
                            <Button variant="default">
                                Contact Support
                            </Button>
                            <Button variant="outline">
                                Documentation
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}

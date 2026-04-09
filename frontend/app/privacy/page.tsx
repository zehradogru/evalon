import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function PrivacyPage() {
    return (
        <div className="min-h-screen bg-[#131722] p-8">
            <div className="mx-auto max-w-4xl">
                <div className="mb-8">
                    <Link href="/login">
                        <Button variant="ghost" className="text-slate-400 hover:text-white">
                            ← Back
                        </Button>
                    </Link>
                </div>

                <div className="space-y-6 text-slate-300">
                    <h1 className="text-4xl font-bold text-white">Privacy Policy</h1>
                    <p className="text-slate-400">Last updated: February 14, 2026</p>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">1. Information We Collect</h2>
                        <p>
                            When you create an account on EVALON Web, we collect the following information:
                        </p>
                        <ul className="list-inside list-disc space-y-2 pl-4">
                            <li>Email address</li>
                            <li>Display name</li>
                            <li>Authentication credentials (handled securely by Firebase)</li>
                            <li>Usage data and analytics</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">2. How We Use Your Information</h2>
                        <p>We use the collected information for the following purposes:</p>
                        <ul className="list-inside list-disc space-y-2 pl-4">
                            <li>To provide and maintain our Service</li>
                            <li>To authenticate and verify your identity</li>
                            <li>To send you important service updates</li>
                            <li>To improve and personalize your experience</li>
                            <li>To analyze usage patterns and optimize the platform</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">3. Data Storage and Security</h2>
                        <p>
                            Your data is stored securely using Firebase Authentication and Google Cloud Platform.
                            We implement industry-standard security measures to protect your personal information.
                        </p>
                        <p className="rounded-lg bg-blue-900/20 p-4 text-sm text-blue-300">
                            <strong>Authentication:</strong> We use Firebase Authentication, which provides
                            enterprise-grade security and encrypted password storage.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">4. Third-Party Services</h2>
                        <p>We use the following third-party services that may collect your information:</p>
                        <ul className="list-inside list-disc space-y-2 pl-4">
                            <li>
                                <strong>Firebase (Google)</strong> - Authentication and data storage
                            </li>
                            <li>
                                <strong>Vercel</strong> - Web hosting and deployment
                            </li>
                            <li>
                                <strong>Google Analytics</strong> (optional) - Usage analytics
                            </li>
                        </ul>
                        <p className="text-sm">
                            Each of these services has their own privacy policies governing their use of your data.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">5. Cookies and Tracking</h2>
                        <p>
                            We use cookies and similar tracking technologies to track activity on our Service and
                            hold certain information. You can instruct your browser to refuse all cookies or to
                            indicate when a cookie is being sent.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">6. Your Data Rights</h2>
                        <p>You have the right to:</p>
                        <ul className="list-inside list-disc space-y-2 pl-4">
                            <li>Access your personal data</li>
                            <li>Correct inaccurate data</li>
                            <li>Request deletion of your data</li>
                            <li>Export your data</li>
                            <li>Opt-out of marketing communications</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">7. Data Retention</h2>
                        <p>
                            We retain your personal information only for as long as necessary to provide you with
                            our Service and as required by law. If you delete your account, your data will be
                            permanently removed within 30 days.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">8. Children's Privacy</h2>
                        <p>
                            Our Service is not intended for individuals under the age of 18. We do not knowingly
                            collect personal information from children. If you are a parent or guardian and believe
                            your child has provided us with personal data, please contact us.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">9. Changes to This Policy</h2>
                        <p>
                            We may update our Privacy Policy from time to time. We will notify you of any changes by
                            posting the new Privacy Policy on this page and updating the "Last updated" date.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">10. Contact Us</h2>
                        <p>
                            If you have any questions about this Privacy Policy, please contact us through our Help
                            Center or via email.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    )
}

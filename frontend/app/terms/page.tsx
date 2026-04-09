import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function TermsPage() {
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
                    <h1 className="text-4xl font-bold text-white">Terms of Service</h1>
                    <p className="text-slate-400">Last updated: February 14, 2026</p>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">1. Acceptance of Terms</h2>
                        <p>
                            By accessing and using EVALON Web ("the Service"), you accept and agree to be bound by
                            the terms and provisions of this agreement.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">2. Use License</h2>
                        <p>
                            Permission is granted to temporarily access the Service for personal, non-commercial use.
                            This is the grant of a license, not a transfer of title.
                        </p>
                        <p>Under this license, you may not:</p>
                        <ul className="list-inside list-disc space-y-2 pl-4">
                            <li>Modify or copy the materials</li>
                            <li>Use the materials for any commercial purpose</li>
                            <li>Attempt to reverse engineer any software contained in the Service</li>
                            <li>Remove any copyright or proprietary notations from the materials</li>
                        </ul>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">3. Trading and Financial Information</h2>
                        <p>
                            EVALON Web provides market data and trading information for educational and informational
                            purposes only. We are not financial advisors, and nothing on this platform should be
                            construed as financial advice.
                        </p>
                        <p className="font-semibold text-amber-400">
                            Trading involves substantial risk and is not suitable for all investors.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">4. User Accounts</h2>
                        <p>
                            You are responsible for maintaining the confidentiality of your account credentials and
                            for all activities that occur under your account. You agree to notify us immediately of
                            any unauthorized use.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">5. Disclaimer</h2>
                        <p>
                            The materials on EVALON Web are provided "as is". We make no warranties, expressed or
                            implied, and hereby disclaim and negate all other warranties. We do not warrant or make
                            any representations concerning the accuracy or reliability of the materials.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">6. Limitations</h2>
                        <p>
                            In no event shall EVALON Web or its suppliers be liable for any damages (including,
                            without limitation, damages for loss of data, profits, or business interruption) arising
                            out of the use or inability to use the Service.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">7. Modifications</h2>
                        <p>
                            EVALON Web may revise these terms of service at any time without notice. By using this
                            Service, you agree to be bound by the current version of these terms.
                        </p>
                    </section>

                    <section className="space-y-4">
                        <h2 className="text-2xl font-semibold text-white">8. Contact Information</h2>
                        <p>
                            If you have any questions about these Terms, please contact us through our Help Center.
                        </p>
                    </section>
                </div>
            </div>
        </div>
    )
}

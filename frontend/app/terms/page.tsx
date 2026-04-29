import Link from 'next/link'
import { LandingNavbar } from '@/features/landing/landing-navbar'
import { Footer } from '@/features/landing/footer'
import { FileText, Shield, AlertCircle, CheckCircle } from 'lucide-react'

const sections = [
  {
    id: 'acceptance',
    title: '1. Acceptance of Terms',
    content: `By accessing or using Evalon ("the Platform"), you agree to be bound by these Terms of Service and all applicable laws and regulations. If you do not agree with any of these terms, you are prohibited from using or accessing this site. These terms apply to all visitors, users and others who access or use the Service.`,
  },
  {
    id: 'description',
    title: '2. Description of Service',
    content: `Evalon is a financial data and analytics platform providing real-time market data, charting tools, backtesting capabilities, AI-powered analysis, paper trading simulations, and community features. The Platform is intended for informational and educational purposes only. Nothing on the Platform constitutes financial advice, investment advice, or a solicitation to buy or sell securities.`,
  },
  {
    id: 'accounts',
    title: '3. User Accounts',
    content: `To access certain features of the Platform, you must register for an account. You agree to provide accurate, current, and complete information during registration and to update such information to keep it accurate, current and complete. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.`,
  },
  {
    id: 'financial',
    title: '4. Financial Information Disclaimer',
    content: `All content provided on the Platform, including but not limited to market data, charts, news, analysis, and AI-generated insights, is for informational purposes only and should not be construed as professional financial or investment advice. Past performance is not indicative of future results. Evalon does not guarantee the accuracy, completeness, or timeliness of any information on the Platform. You acknowledge that all trading and investment decisions are made at your own risk.`,
  },
  {
    id: 'prohibited',
    title: '5. Prohibited Uses',
    content: `You agree not to use the Platform to: (a) violate any applicable laws or regulations; (b) transmit any harmful, offensive, or disruptive content; (c) attempt to gain unauthorized access to any part of the Platform; (d) use automated tools to scrape, crawl, or extract data without written permission; (e) impersonate any person or entity; (f) engage in market manipulation or other fraudulent activities; (g) interfere with or disrupt the integrity or performance of the Platform.`,
  },
  {
    id: 'intellectual',
    title: '6. Intellectual Property',
    content: `The Platform and its original content, features, and functionality are owned by Evalon and are protected by international copyright, trademark, patent, trade secret, and other intellectual property laws. Our trademarks and trade dress may not be used in connection with any product or service without the prior written consent of Evalon.`,
  },
  {
    id: 'subscription',
    title: '7. Subscription and Payments',
    content: `Certain features of the Platform require a paid subscription. By selecting a subscription plan, you agree to pay the applicable fees. All fees are non-refundable except as required by law. We reserve the right to change subscription fees at any time, with notice provided to existing subscribers. Cancellation of a subscription will take effect at the end of the current billing period.`,
  },
  {
    id: 'privacy',
    title: '8. Privacy Policy',
    content: `Your use of the Platform is also governed by our Privacy Policy, which is incorporated into these Terms of Service by reference. Please review our Privacy Policy to understand our practices regarding the collection and use of your personal information.`,
  },
  {
    id: 'termination',
    title: '9. Termination',
    content: `We may terminate or suspend your account and access to the Platform immediately, without prior notice or liability, for any reason, including without limitation if you breach these Terms. Upon termination, your right to use the Platform will cease immediately. All provisions which by their nature should survive termination shall survive.`,
  },
  {
    id: 'limitation',
    title: '10. Limitation of Liability',
    content: `In no event shall Evalon, its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses, resulting from your access to or use of (or inability to access or use) the Platform.`,
  },
  {
    id: 'changes',
    title: '11. Changes to Terms',
    content: `We reserve the right to modify these terms at any time. We will provide notice of significant changes by updating the date at the top of this page and, where appropriate, notifying you by email. Your continued use of the Platform after any changes constitutes acceptance of the new Terms.`,
  },
  {
    id: 'contact',
    title: '12. Contact Us',
    content: `If you have any questions about these Terms of Service, please contact us at legal@evalon.app or through our Help Center. We aim to respond to all inquiries within 2 business days.`,
  },
]

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[#131722] text-[#d1d4dc]">
      <LandingNavbar />

      {/* Hero */}
      <div className="pt-28 pb-16 px-4 text-center border-b border-[#2a2e39]/50">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#2962ff]/10 border border-[#2962ff]/20 mb-6">
          <FileText className="w-7 h-7 text-[#2962ff]" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Terms of Service</h1>
        <p className="text-[#787b86] text-lg max-w-xl mx-auto">
          Please read these terms carefully before using Evalon.
        </p>
        <p className="text-sm text-[#787b86] mt-4">Last updated: April 29, 2026</p>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-16 flex gap-12">

        {/* Sidebar TOC */}
        <aside className="hidden lg:block w-64 flex-shrink-0">
          <div className="sticky top-24">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#787b86] mb-4">Contents</p>
            <nav className="flex flex-col gap-1">
              {sections.map(s => (
                <a
                  key={s.id}
                  href={`#${s.id}`}
                  className="text-sm text-[#787b86] hover:text-white py-1.5 px-3 rounded-lg hover:bg-[#1e222d] transition-colors"
                >
                  {s.title}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Alert Banner */}
          <div className="flex items-start gap-3 bg-[#2962ff]/10 border border-[#2962ff]/20 rounded-xl p-4 mb-10">
            <AlertCircle className="w-5 h-5 text-[#2962ff] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-white">Important Notice</p>
              <p className="text-sm text-[#787b86] mt-0.5">
                Evalon is a financial data platform, not a licensed broker or financial advisor. All content is for informational purposes only.
              </p>
            </div>
          </div>

          <div className="space-y-10">
            {sections.map(s => (
              <section key={s.id} id={s.id} className="scroll-mt-28">
                <h2 className="text-xl font-bold text-white mb-3">{s.title}</h2>
                <p className="text-[#787b86] leading-relaxed">{s.content}</p>
              </section>
            ))}
          </div>

          {/* Footer nav */}
          <div className="mt-16 pt-8 border-t border-[#2a2e39]/50 flex flex-wrap gap-4">
            <Link href="/privacy" className="flex items-center gap-2 text-sm text-[#2962ff] hover:text-[#5585ff] transition-colors">
              <Shield className="w-4 h-4" /> Privacy Policy
            </Link>
            <Link href="/help" className="flex items-center gap-2 text-sm text-[#2962ff] hover:text-[#5585ff] transition-colors">
              <CheckCircle className="w-4 h-4" /> Help Center
            </Link>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  )
}

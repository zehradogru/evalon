import Link from 'next/link'
import { LandingNavbar } from '@/features/landing/landing-navbar'
import { Footer } from '@/features/landing/footer'
import { Shield, Lock, Eye, Database, UserCheck, Globe, Bell, FileText } from 'lucide-react'

const highlights = [
  { icon: Lock, title: 'End-to-End Encryption', desc: 'All data in transit is encrypted using TLS 1.3.' },
  { icon: Eye, title: 'No Data Selling', desc: 'We never sell your personal data to third parties.' },
  { icon: Database, title: 'Minimal Collection', desc: 'We only collect what is needed for the service.' },
  { icon: UserCheck, title: 'Your Rights', desc: 'Access, correct, or delete your data anytime.' },
]

const sections = [
  {
    id: 'information',
    title: '1. Information We Collect',
    content: [
      { sub: 'Account Information', text: 'When you create an account, we collect your name, email address, and a hashed version of your password. You may optionally provide a profile picture and display name.' },
      { sub: 'Usage Data', text: 'We collect information about how you interact with the Platform, including pages visited, features used, search queries, watchlist configurations, and time spent on various sections. This data helps us improve the service.' },
      { sub: 'Device & Technical Data', text: 'We collect your IP address, browser type and version, operating system, referral source, and device identifiers to ensure compatibility and detect fraudulent activity.' },
      { sub: 'Subscription & Payment', text: 'Payments are processed by Stripe. We do not store your full card number. We retain transaction records including plan type, amount, and billing date.' },
    ],
  },
  {
    id: 'usage',
    title: '2. How We Use Your Information',
    content: [
      { sub: 'Service Delivery', text: 'To provide, operate, and maintain the Platform, including personalizing your experience, saving your preferences, and syncing your watchlists.' },
      { sub: 'Improvements', text: 'To understand usage patterns, identify bugs, test new features, and improve our algorithms including the AI analysis models.' },
      { sub: 'Communications', text: 'To send you service-related emails (account confirmations, security alerts) and, with your consent, product updates and newsletters.' },
      { sub: 'Security & Compliance', text: 'To detect, prevent, and address fraud, abuse, and security incidents, and to comply with legal obligations.' },
    ],
  },
  {
    id: 'sharing',
    title: '3. Information Sharing',
    content: [
      { sub: 'Service Providers', text: 'We share data with trusted third-party vendors who assist us in operating the Platform (hosting, analytics, payment processing, email delivery). These parties are contractually obligated to protect your data.' },
      { sub: 'Legal Requirements', text: 'We may disclose your information if required to do so by law, court order, or governmental authority, or if we believe disclosure is necessary to protect our rights or the safety of users.' },
      { sub: 'Business Transfers', text: 'In the event of a merger, acquisition, or sale of assets, your data may be transferred. We will notify you of any such change.' },
      { sub: 'No Selling', text: 'We do not sell, trade, or rent your personal information to third parties for their marketing purposes.' },
    ],
  },
  {
    id: 'cookies',
    title: '4. Cookies & Tracking',
    content: [
      { sub: 'Essential Cookies', text: 'Required for the Platform to function correctly, including authentication tokens and session management. These cannot be disabled.' },
      { sub: 'Analytics Cookies', text: 'Help us understand how users interact with the Platform using tools like Google Analytics. You may opt out via browser settings or our cookie preferences panel.' },
      { sub: 'Preference Cookies', text: 'Remember your settings such as theme preference, chart layout, and default timeframes.' },
    ],
  },
  {
    id: 'security',
    title: '5. Data Security',
    content: [
      { sub: 'Technical Measures', text: 'We implement industry-standard security measures including TLS encryption in transit, AES-256 encryption at rest, and regular security audits. Our infrastructure runs on Google Cloud Platform.' },
      { sub: 'Access Controls', text: 'Employee access to user data is restricted on a need-to-know basis. All access is logged and reviewed regularly.' },
      { sub: 'Incident Response', text: 'In the event of a data breach, we will notify affected users within 72 hours as required by applicable regulations.' },
    ],
  },
  {
    id: 'rights',
    title: '6. Your Rights',
    content: [
      { sub: 'Access & Portability', text: 'You have the right to access your personal data and receive a copy in a structured, machine-readable format. Request via your account settings or by contacting privacy@evalon.app.' },
      { sub: 'Correction', text: 'You may update or correct inaccurate information at any time through your profile settings.' },
      { sub: 'Deletion', text: 'You may request deletion of your account and associated data. Note that some data may be retained for legal compliance or fraud prevention purposes.' },
      { sub: 'Opt-Out', text: 'You may opt out of marketing communications at any time using the unsubscribe link in emails or through your notification preferences.' },
    ],
  },
  {
    id: 'retention',
    title: '7. Data Retention',
    content: [
      { sub: 'Active Accounts', text: 'We retain your data for as long as your account is active or as needed to provide services.' },
      { sub: 'Deleted Accounts', text: 'After account deletion, we retain certain data for up to 90 days in backups before permanent deletion. Anonymized, aggregated data may be retained indefinitely.' },
    ],
  },
  {
    id: 'contact',
    title: '8. Contact & DPO',
    content: [
      { sub: 'Privacy Contact', text: 'For privacy-related inquiries, please email privacy@evalon.app or write to: Evalon Privacy Team, Istanbul, Turkey.' },
      { sub: 'Response Time', text: 'We will respond to all privacy requests within 30 days.' },
    ],
  },
]

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-[#131722] text-[#d1d4dc]">
      <LandingNavbar />

      {/* Hero */}
      <div className="pt-28 pb-16 px-4 text-center border-b border-[#2a2e39]/50">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#089981]/10 border border-[#089981]/20 mb-6">
          <Shield className="w-7 h-7 text-[#089981]" />
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
        <p className="text-[#787b86] text-lg max-w-xl mx-auto">
          We take your privacy seriously. Here is exactly how we handle your data.
        </p>
        <p className="text-sm text-[#787b86] mt-4">Last updated: April 29, 2026</p>
      </div>

      {/* Highlights */}
      <div className="max-w-5xl mx-auto px-4 pt-12 pb-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {highlights.map(({ icon: Icon, title, desc }) => (
            <div key={title} className="bg-[#1e222d] border border-[#2a2e39] rounded-xl p-5 text-center hover:border-[#787b86] transition-colors">
              <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-[#089981]/10 mb-3">
                <Icon className="w-5 h-5 text-[#089981]" />
              </div>
              <p className="text-sm font-semibold text-white mb-1">{title}</p>
              <p className="text-xs text-[#787b86]">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10 flex gap-12">
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
        <main className="flex-1 min-w-0 space-y-10">
          {sections.map(s => (
            <section key={s.id} id={s.id} className="scroll-mt-28">
              <h2 className="text-xl font-bold text-white mb-4">{s.title}</h2>
              <div className="space-y-4">
                {s.content.map(item => (
                  <div key={item.sub} className="pl-4 border-l-2 border-[#2a2e39]">
                    <p className="text-sm font-semibold text-white mb-1">{item.sub}</p>
                    <p className="text-sm text-[#787b86] leading-relaxed">{item.text}</p>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <div className="mt-8 pt-8 border-t border-[#2a2e39]/50 flex flex-wrap gap-4">
            <Link href="/terms" className="flex items-center gap-2 text-sm text-[#2962ff] hover:text-[#5585ff] transition-colors">
              <FileText className="w-4 h-4" /> Terms of Service
            </Link>
            <Link href="/help" className="flex items-center gap-2 text-sm text-[#2962ff] hover:text-[#5585ff] transition-colors">
              <Globe className="w-4 h-4" /> Help Center
            </Link>
          </div>
        </main>
      </div>

      <Footer />
    </div>
  )
}

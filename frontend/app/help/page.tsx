'use client'

import Link from 'next/link'
import { useState } from 'react'
import { LandingNavbar } from '@/features/landing/landing-navbar'
import { Footer } from '@/features/landing/footer'
import {
  Search, BarChart3, Cpu, TrendingUp, BookOpen, Shield,
  CreditCard, ChevronRight, ChevronDown, MessageCircle,
  Mail, ExternalLink, Zap, Activity
} from 'lucide-react'

const categories = [
  {
    icon: BarChart3,
    title: 'Charts & Markets',
    color: 'text-[#2962ff]',
    bg: 'bg-[#2962ff]/10',
    border: 'border-[#2962ff]/20',
    count: 12,
    href: '#charts',
  },
  {
    icon: Activity,
    title: 'Backtesting',
    color: 'text-[#089981]',
    bg: 'bg-[#089981]/10',
    border: 'border-[#089981]/20',
    count: 8,
    href: '#backtest',
  },
  {
    icon: Cpu,
    title: 'Evalon AI',
    color: 'text-[#d236f9]',
    bg: 'bg-[#d236f9]/10',
    border: 'border-[#d236f9]/20',
    count: 6,
    href: '#ai',
  },
  {
    icon: TrendingUp,
    title: 'Screener & Alerts',
    color: 'text-[#f7525f]',
    bg: 'bg-[#f7525f]/10',
    border: 'border-[#f7525f]/20',
    count: 9,
    href: '#screener',
  },
  {
    icon: BookOpen,
    title: 'Academy & Learning',
    color: 'text-[#ff9800]',
    bg: 'bg-[#ff9800]/10',
    border: 'border-[#ff9800]/20',
    count: 5,
    href: '#academy',
  },
  {
    icon: CreditCard,
    title: 'Billing & Plans',
    color: 'text-[#00bceb]',
    bg: 'bg-[#00bceb]/10',
    border: 'border-[#00bceb]/20',
    count: 7,
    href: '#billing',
  },
  {
    icon: Shield,
    title: 'Account & Security',
    color: 'text-[#2962ff]',
    bg: 'bg-[#2962ff]/10',
    border: 'border-[#2962ff]/20',
    count: 10,
    href: '#account',
  },
  {
    icon: Zap,
    title: 'Paper Trading',
    color: 'text-[#089981]',
    bg: 'bg-[#089981]/10',
    border: 'border-[#089981]/20',
    count: 6,
    href: '#paper',
  },
]

const faqs = [
  {
    q: 'How do I get started with Evalon?',
    a: 'Sign up for a free account to access the Basic plan. You can start charting, using the screener, and exploring the community right away. For advanced features like backtesting and AI analysis, upgrade to Pro or Premium.',
  },
  {
    q: 'Is the market data real-time?',
    a: 'Pro and Premium subscribers receive real-time BIST data. Basic accounts receive data with a 15-minute delay. For international markets (NASDAQ, Crypto, Forex), data update frequency depends on your subscription tier.',
  },
  {
    q: 'How does the Backtesting engine work?',
    a: 'The backtesting engine simulates your strategy against historical BIST data. You define entry/exit conditions using technical rules, set position sizing and risk parameters, and the engine returns detailed performance statistics including win rate, drawdown, and trade log.',
  },
  {
    q: 'What is Evalon AI?',
    a: 'Evalon AI is our machine learning model trained on BIST price action, news sentiment, and macroeconomic signals. It generates confidence-scored trade ideas, supports natural language queries, and can analyze your portfolio for risk.',
  },
  {
    q: 'Can I cancel my subscription at any time?',
    a: 'Yes. You can cancel anytime from your account settings. Your subscription will remain active until the end of the current billing period. No refunds are issued for partial months, but you won\'t be charged again.',
  },
  {
    q: 'How do I reset my password?',
    a: 'Click "Forgot Password" on the login page and enter your email. You\'ll receive a reset link within a few minutes. If you don\'t see it, check your spam folder or contact support.',
  },
  {
    q: 'Is paper trading with real market prices?',
    a: 'Yes. Paper trading uses real-time (or delayed, depending on your plan) market prices for order execution simulation. Your virtual portfolio tracks performance as if you were trading with real money, without any financial risk.',
  },
  {
    q: 'How do I connect a broker?',
    a: 'Go to the Brokers page in your dashboard. We are currently building integrations with major Turkish and international brokers. You can sign up for early access to broker connectivity from the Brokers page.',
  },
]

export default function HelpPage() {
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [search, setSearch] = useState('')

  const filteredFaqs = search.trim()
    ? faqs.filter(f =>
        f.q.toLowerCase().includes(search.toLowerCase()) ||
        f.a.toLowerCase().includes(search.toLowerCase())
      )
    : faqs

  return (
    <div className="min-h-screen bg-[#131722] text-[#d1d4dc]">
      <LandingNavbar />

      {/* Hero */}
      <div className="pt-28 pb-20 px-4 text-center bg-gradient-to-b from-[#131722] to-[#0f1117]">
        <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">How can we help?</h1>
        <p className="text-[#787b86] text-lg mb-10">
          Search our knowledge base or browse topics below.
        </p>

        {/* Search Bar */}
        <div className="relative max-w-xl mx-auto">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#787b86]" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search for articles, guides, and answers..."
            className="w-full bg-[#1e222d] border border-[#2a2e39] rounded-2xl pl-12 pr-6 py-4 text-white placeholder:text-[#787b86] focus:outline-none focus:border-[#2962ff] transition-colors text-base"
          />
        </div>

        <div className="flex items-center justify-center gap-6 mt-6 text-sm text-[#787b86]">
          <span>Popular:</span>
          {['Backtesting setup', 'Cancel subscription', 'Reset password', 'Paper trading'].map(tag => (
            <button
              key={tag}
              onClick={() => setSearch(tag)}
              className="text-[#2962ff] hover:text-[#5585ff] transition-colors"
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Categories */}
      <div className="max-w-6xl mx-auto px-4 py-16">
        <h2 className="text-2xl font-bold text-white mb-8">Browse by topic</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {categories.map(cat => (
            <a
              key={cat.title}
              href={cat.href}
              className={`flex items-start gap-4 bg-[#1e222d] border ${cat.border} rounded-xl p-5 hover:border-[#787b86] transition-all group`}
            >
              <div className={`${cat.bg} rounded-lg p-2.5 flex-shrink-0`}>
                <cat.icon className={`w-5 h-5 ${cat.color}`} />
              </div>
              <div>
                <p className="font-semibold text-white text-sm group-hover:text-[#2962ff] transition-colors">{cat.title}</p>
                <p className="text-xs text-[#787b86] mt-0.5">{cat.count} articles</p>
              </div>
              <ChevronRight className="w-4 h-4 text-[#787b86] ml-auto flex-shrink-0 mt-0.5 group-hover:text-white transition-colors" />
            </a>
          ))}
        </div>
      </div>

      {/* FAQ */}
      <div className="max-w-3xl mx-auto px-4 pb-20">
        <h2 className="text-2xl font-bold text-white mb-2">Frequently Asked Questions</h2>
        <p className="text-[#787b86] mb-8">
          {search ? `${filteredFaqs.length} result${filteredFaqs.length !== 1 ? 's' : ''} for "${search}"` : 'Quick answers to common questions.'}
        </p>

        <div className="space-y-2">
          {filteredFaqs.length === 0 ? (
            <div className="text-center py-12 text-[#787b86]">
              <Search className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p>No results found. Try a different search term or contact support.</p>
            </div>
          ) : (
            filteredFaqs.map((faq, i) => (
              <div
                key={i}
                className="bg-[#1e222d] border border-[#2a2e39] rounded-xl overflow-hidden"
              >
                <button
                  className="w-full flex items-center justify-between p-5 text-left hover:bg-[#2a2e39]/40 transition-colors"
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                >
                  <span className="font-medium text-white pr-4">{faq.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 text-[#787b86] flex-shrink-0 transition-transform ${openFaq === i ? 'rotate-180' : ''}`}
                  />
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-5 text-[#787b86] text-sm leading-relaxed border-t border-[#2a2e39]/50 pt-4">
                    {faq.a}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Contact CTA */}
      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="bg-gradient-to-r from-[#2962ff]/10 to-[#7c3aed]/10 border border-[#2962ff]/20 rounded-2xl p-10 text-center">
          <h2 className="text-2xl font-bold text-white mb-3">Still need help?</h2>
          <p className="text-[#787b86] mb-8 max-w-md mx-auto">
            Our support team is available Mon–Fri, 9am–6pm (Istanbul time). We typically respond within a few hours.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/contact"
              className="flex items-center gap-2 px-6 py-3 bg-[#2962ff] text-white font-semibold rounded-full hover:bg-[#1e53e5] transition-all"
            >
              <MessageCircle className="w-4 h-4" /> Contact Support
            </Link>
            <a
              href="mailto:support@evalon.app"
              className="flex items-center gap-2 px-6 py-3 bg-[#1e222d] text-white font-medium rounded-full border border-[#2a2e39] hover:border-[#787b86] transition-all"
            >
              <Mail className="w-4 h-4" /> support@evalon.app
            </a>
          </div>
        </div>
      </div>

      <Footer />
    </div>
  )
}

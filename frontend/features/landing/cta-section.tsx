'use client'

import Link from 'next/link'
import { ArrowRight, Sparkles } from 'lucide-react'

export function CTASection() {
  return (
    <section className="relative py-24 sm:py-32 bg-black overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[600px]">
          <div className="absolute inset-0 rounded-full bg-[#2962ff]/5 blur-[150px]" />
          <div className="absolute inset-20 rounded-full bg-[#7c3aed]/5 blur-[120px]" />
        </div>
      </div>

      <div className="relative max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#2962ff]/10 border border-[#2962ff]/20 mb-8">
          <Sparkles className="h-3.5 w-3.5 text-[#2962ff]" />
          <span className="text-xs text-[#2962ff] font-semibold tracking-wider uppercase">Start Today</span>
        </div>

        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-6">
          Ready to trade with
          <br />
          <span className="bg-gradient-to-r from-[#2962ff] via-[#7c3aed] to-[#2962ff] bg-clip-text text-transparent">
            artificial intelligence?
          </span>
        </h2>

        <p className="text-lg text-[#787b86] max-w-2xl mx-auto mb-10 leading-relaxed">
          Join thousands of traders who use EVALON&apos;s AI-powered insights to make better decisions.
          Start with a free account — no credit card required.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-[#2962ff] rounded-full hover:bg-[#1e53e5] transition-all duration-200 shadow-lg shadow-[#2962ff]/20 hover:shadow-[#2962ff]/30 hover:scale-[1.02] active:scale-[0.98]"
          >
            Create free account
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-medium text-[#d1d4dc] bg-transparent border border-white/[0.1] rounded-full hover:bg-white/[0.05] hover:border-white/[0.15] transition-all duration-200"
          >
            Sign in
          </Link>
        </div>

        {/* Features summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-16 pt-8 border-t border-white/[0.06]">
          {[
            { label: 'Free forever', desc: 'Core features' },
            { label: 'Real-time data', desc: 'BIST, NASDAQ, Crypto' },
            { label: 'AI signals', desc: 'Buy/Sell/Neutral' },
            { label: 'Backtesting', desc: 'Historical analysis' },
          ].map((item) => (
            <div key={item.label} className="text-center py-3">
              <div className="text-sm font-semibold text-white">{item.label}</div>
              <div className="text-xs text-[#787b86] mt-1">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

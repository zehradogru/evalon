'use client'

import Link from 'next/link'
import { GlobeCanvas } from './globe-canvas'
import { ArrowRight } from 'lucide-react'

const GLOBAL_STATS = [
  { value: '100+', label: 'Markets', sub: 'BIST, NASDAQ, Crypto, Forex' },
  { value: '24/7', label: 'Access', sub: 'Always-on trading infrastructure' },
  { value: '50M+', label: 'Users', sub: 'Across 150+ countries' },
  { value: '99.9%', label: 'Uptime', sub: 'Enterprise-grade reliability' },
]

export function GlobalSection() {
  return (
    <section className="relative py-28 bg-black overflow-hidden">
      {/* Background glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#2862ff]/6 blur-[160px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-[#7c3aed]/5 blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#2862ff]/10 border border-[#2862ff]/25 mb-6">
            <span className="text-xs font-semibold text-[#2862ff] tracking-widest uppercase">Global Coverage</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-white leading-tight mb-5">
            Available Anywhere,{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2862ff] to-[#7c3aed]">Anytime</span>
          </h2>
          <p className="text-lg text-[#787b86] max-w-2xl mx-auto leading-relaxed">
            Our high-performance platform is globally accessible — ensuring you have the tools
            you need to succeed, no matter where you trade from.
          </p>
        </div>

        {/* Globe + Stats layout */}
        <div className="relative flex flex-col items-center">
          {/* Globe */}
          <div className="relative">
            <div className="absolute inset-[-8%] rounded-full bg-[#2862ff]/8 blur-3xl pointer-events-none" />
            <div className="absolute inset-[-4%] rounded-full bg-[#7c3aed]/5 blur-2xl pointer-events-none" />
            <GlobeCanvas size={560} className="relative z-10 drop-shadow-[0_0_80px_rgba(41,98,255,0.3)]" />
          </div>

          {/* Stats grid below globe */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-12 w-full max-w-3xl">
            {GLOBAL_STATS.map(({ value, label, sub }) => (
              <div
                key={label}
                className="flex flex-col items-center text-center p-5 rounded-2xl bg-[#080808] border border-[#1e1e1e] hover:border-[#2862ff]/30 transition-colors"
              >
                <div className="text-3xl font-bold text-white mb-1">{value}</div>
                <div className="text-sm font-semibold text-[#2862ff] mb-1">{label}</div>
                <div className="text-xs text-[#787b86] leading-snug">{sub}</div>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div className="mt-10 text-center">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-base font-semibold text-white bg-[#2862ff] hover:bg-[#1e53e5] transition-all duration-200 shadow-lg shadow-[#2862ff]/25 hover:scale-[1.02] active:scale-[0.98]"
            >
              Start Trading Globally
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

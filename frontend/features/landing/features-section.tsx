'use client'

import { Brain, BarChart3, Cpu, Shield, LineChart, Zap } from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'AI Alpha Picks',
    description: 'Machine learning algorithms analyze 15.7M+ data points to surface high-conviction trade ideas with confidence scores.',
    gradient: 'from-[#2862ff]/20 to-transparent',
    iconBg: 'bg-[#2862ff]/10',
    iconColor: 'text-[#2862ff]',
    border: 'hover:border-[#2862ff]/30',
    glow: 'group-hover:shadow-[0_0_30px_rgba(40,98,255,0.08)]',
  },
  {
    icon: LineChart,
    title: 'Behavioral Analytics',
    description: 'Track your emotional patterns across trades. Understand when FOMO or fear impacts your decisions.',
    gradient: 'from-[#089981]/20 to-transparent',
    iconBg: 'bg-[#089981]/10',
    iconColor: 'text-[#089981]',
    border: 'hover:border-[#089981]/30',
    glow: 'group-hover:shadow-[0_0_30px_rgba(8,153,129,0.08)]',
  },
  {
    icon: BarChart3,
    title: 'Advanced Backtesting',
    description: 'Test strategies against years of historical data. Validate your edge before risking real capital.',
    gradient: 'from-[#7c3aed]/20 to-transparent',
    iconBg: 'bg-[#7c3aed]/10',
    iconColor: 'text-[#7c3aed]',
    border: 'hover:border-[#7c3aed]/30',
    glow: 'group-hover:shadow-[0_0_30px_rgba(124,58,237,0.08)]',
  },
  {
    icon: Zap,
    title: 'Real-time Data Feed',
    description: 'Sub-second price updates across BIST, NASDAQ, Crypto, and Forex markets. Never miss a move.',
    gradient: 'from-yellow-500/20 to-transparent',
    iconBg: 'bg-yellow-500/10',
    iconColor: 'text-yellow-400',
    border: 'hover:border-yellow-500/30',
    glow: 'group-hover:shadow-[0_0_30px_rgba(234,179,8,0.08)]',
  },
  {
    icon: Cpu,
    title: 'Algorithmic Trading',
    description: 'Build, deploy, and monitor automated trading strategies with our visual strategy builder.',
    gradient: 'from-[#06b6d4]/20 to-transparent',
    iconBg: 'bg-[#06b6d4]/10',
    iconColor: 'text-[#06b6d4]',
    border: 'hover:border-[#06b6d4]/30',
    glow: 'group-hover:shadow-[0_0_30px_rgba(6,182,212,0.08)]',
  },
  {
    icon: Shield,
    title: 'Risk Management',
    description: 'Portfolio-level risk scoring, position sizing recommendations, and automated stop-loss management.',
    gradient: 'from-rose-500/20 to-transparent',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-400',
    border: 'hover:border-rose-500/30',
    glow: 'group-hover:shadow-[0_0_30px_rgba(244,63,94,0.08)]',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 sm:py-32 bg-black overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-[#2862ff]/[0.03] blur-[120px]" />
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2862ff]/10 border border-[#2862ff]/20 mb-6">
            <Zap size={12} className="text-[#2862ff]" />
            <span className="text-xs text-[#2862ff] font-semibold tracking-wider uppercase">Platform Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-5 tracking-tight">
            Everything you need to{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2862ff] to-[#7c3aed]">
              trade smarter
            </span>
          </h2>
          <p className="text-lg text-[#787b86] leading-relaxed">
            Professional-grade tools powered by artificial intelligence, designed for both beginners and seasoned traders.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className={`group relative p-6 rounded-2xl bg-white/[0.02] border border-white/[0.06] ${feature.border} transition-all duration-300 overflow-hidden ${feature.glow}`}
              >
                {/* Top gradient accent */}
                <div className={`absolute top-0 left-0 right-0 h-px bg-gradient-to-r ${feature.gradient}`} />

                <div className="relative">
                  {/* Icon */}
                  <div className={`inline-flex p-3 rounded-xl ${feature.iconBg} mb-5`}>
                    <Icon className={`h-5 w-5 ${feature.iconColor}`} />
                  </div>

                  {/* Title */}
                  <h3 className="text-base font-semibold text-white mb-2.5 group-hover:text-white transition-colors">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-[#787b86] leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

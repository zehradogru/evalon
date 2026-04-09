'use client'

import { Brain, BarChart3, Cpu, Shield, LineChart, Zap } from 'lucide-react'

const features = [
  {
    icon: Brain,
    title: 'AI Alpha Picks',
    description: 'Machine learning algorithms analyze 15.7M+ data points to surface high-conviction trade ideas with confidence scores.',
    color: 'text-primary',
  },
  {
    icon: LineChart,
    title: 'Behavioral Analytics',
    description: 'Track your emotional patterns across trades. Understand when FOMO or fear impacts your decisions.',
    color: 'text-chart-2',
  },
  {
    icon: BarChart3,
    title: 'Advanced Backtesting',
    description: 'Test strategies against years of historical data. Validate your edge before risking real capital.',
    color: 'text-chart-3',
  },
  {
    icon: Zap,
    title: 'Real-time Data Feed',
    description: 'Sub-second price updates across BIST, NASDAQ, Crypto, and Forex markets. Never miss a move.',
    color: 'text-chart-5',
  },
  {
    icon: Cpu,
    title: 'Algorithmic Trading',
    description: 'Build, deploy, and monitor automated trading strategies with our visual strategy builder.',
    color: 'text-chart-4',
  },
  {
    icon: Shield,
    title: 'Risk Management',
    description: 'Portfolio-level risk scoring, position sizing recommendations, and automated stop-loss management.',
    color: 'text-[#06b6d4]',
  },
]

export function FeaturesSection() {
  return (
    <section id="features" className="relative py-24 sm:py-32 bg-background">
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16 sm:mb-20">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <span className="text-xs text-primary font-semibold tracking-wider uppercase">Platform Features</span>
          </div>
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white leading-tight mb-4">
            Everything you need to{' '}
            <span className="text-primary">
              trade smarter
            </span>
          </h2>
          <p className="text-lg text-muted-foreground leading-relaxed">
            Professional-grade tools powered by artificial intelligence, designed for both beginners and seasoned traders.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {features.map((feature) => {
            const Icon = feature.icon
            return (
              <div
                key={feature.title}
                className="group relative p-6 rounded-2xl bg-secondary border border-border hover:border-primary/50 transition-all duration-300"
              >
                <div className="relative">
                  {/* Icon */}
                  <div className={`inline-flex p-3 rounded-xl bg-background border border-border mb-5`}>
                    <Icon className={`h-6 w-6 ${feature.color}`} />
                  </div>

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-white mb-2 group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>

                  {/* Description */}
                  <p className="text-sm text-muted-foreground leading-relaxed">
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

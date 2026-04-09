'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'
import { PRICING_PLANS } from './pricing-data'
import Link from 'next/link'
import { LandingNavbar } from '../landing/landing-navbar'

export function PricingView() {
    const [isYearly, setIsYearly] = useState(true)

    return (
        <div className="min-h-screen bg-[#000000] text-white selection:bg-[#2962ff] selection:text-white pb-20">
            <LandingNavbar />

            {/* Background Gradients */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-[#2962ff]/20 rounded-full blur-[120px] mix-blend-screen" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-[#d236f9]/20 rounded-full blur-[120px] mix-blend-screen" />
            </div>

            <div className="relative z-10 pt-32 px-4 max-w-7xl mx-auto text-center">
                {/* Header */}
                <div
                    className="mb-16 animate-in fade-in slide-in-from-bottom-8 duration-700"
                >
                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">
                        Choose your edge.
                    </h1>
                    <p className="text-xl text-[#787b86] max-w-2xl mx-auto">
                        Professional tools for every level of trader. <br className="hidden sm:block" />
                        Start with our flexible plans and scale as you grow.
                    </p>

                    {/* Toggle */}
                    <div className="flex items-center justify-center gap-4 mt-10">
                        <span className={`text-sm font-medium ${!isYearly ? 'text-white' : 'text-[#787b86]'} transition-colors`}>Monthly</span>
                        <button
                            onClick={() => setIsYearly(!isYearly)}
                            className="w-14 h-8 bg-[#1e222d] border border-[#2a2e39] rounded-full relative p-1 transition-colors hover:border-[#2962ff]/50"
                        >
                            <div className={`w-6 h-6 bg-[#2962ff] rounded-full transition-transform duration-300 ${isYearly ? 'translate-x-6' : 'translate-x-0'}`} />
                        </button>
                        <span className={`text-sm font-medium ${isYearly ? 'text-white' : 'text-[#787b86]'} transition-colors`}>
                            Yearly <span className="text-[#2962ff] text-xs ml-1 font-bold">SAVE 20%</span>
                        </span>
                    </div>
                </div>

                {/* Cards Grid */}
                <div className="grid md:grid-cols-3 gap-8 items-start">
                    {PRICING_PLANS.map((plan, index) => (
                        <div
                            key={plan.id}
                            className={`relative p-8 rounded-3xl border text-left flex flex-col h-full animate-in fade-in slide-in-from-bottom-8 duration-700 fill-mode-backwards ${plan.highlight
                                    ? 'bg-[#131722] border-[#2962ff] shadow-[0_0_40px_-10px_rgba(41,98,255,0.3)]'
                                    : 'bg-[#0f1117] border-[#2a2e39] hover:border-[#787b86] transition-colors'
                                }`}
                            style={{ animationDelay: `${index * 150}ms` }}
                        >
                            {plan.highlight && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-[#2962ff] to-[#d236f9] rounded-full text-xs font-bold text-white shadow-lg whitespace-nowrap">
                                    MOST POPULAR
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1 mb-4">
                                    <span className="text-4xl font-bold text-white">
                                        ${isYearly ? plan.price.yearly / 12 : plan.price.monthly}
                                    </span>
                                    <span className="text-[#787b86]">/mo</span>
                                </div>
                                <p className="text-sm text-[#787b86] leading-relaxed">
                                    {plan.description}
                                </p>
                            </div>

                            <div className="flex-grow mb-8 space-y-4">
                                {plan.features.map((feature, i) => (
                                    <div key={i} className="flex items-start gap-3">
                                        <div className={`mt-0.5 rounded-full p-0.5 ${plan.highlight ? 'bg-[#2962ff]/20 text-[#2962ff]' : 'bg-[#2a2e39] text-[#b2b5be]'}`}>
                                            <Check className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-sm text-[#d1d4dc]">{feature}</span>
                                    </div>
                                ))}
                            </div>

                            <Link
                                href="/signup"
                                className={`w-full py-4 rounded-xl font-bold text-center transition-all duration-200 ${plan.highlight
                                        ? 'bg-gradient-to-r from-[#2962ff] to-[#00bceb] text-white hover:shadow-[0_0_20px_-5px_rgba(41,98,255,0.5)] hover:brightness-110'
                                        : 'bg-[#1e222d] text-white hover:bg-[#2a2e39] border border-[#2a2e39]'
                                    }`}
                            >
                                {plan.cta}
                            </Link>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    )
}

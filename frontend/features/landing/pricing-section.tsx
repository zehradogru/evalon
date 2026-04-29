'use client';

import { useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import Link from 'next/link';
import { usePricing } from '@/hooks/use-pricing';

export function PricingSection() {
    const [isAnnual, setIsAnnual] = useState(true);
    const { data: plans = [], isLoading } = usePricing();

    return (
        <section className="bg-black py-24 text-white" id="pricing">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-16 text-center">
                    <h2 className="text-4xl font-bold tracking-tight text-white mb-6 md:text-5xl">
                        Select your plan
                    </h2>
                    <p className="text-xl text-[#787b86] max-w-3xl mx-auto mb-10">
                        No commitment. Cancel anytime.
                    </p>

                    {/* Toggle */}
                    <div className="flex items-center justify-center gap-4">
                        <span className={cn('text-sm font-medium transition-colors', !isAnnual ? 'text-white' : 'text-[#787b86]')}>
                            Monthly
                        </span>
                        <button
                            onClick={() => setIsAnnual(!isAnnual)}
                            className="relative h-7 w-12 rounded-full bg-white/[0.06] border border-white/[0.1] p-1 transition-colors hover:border-[#2862ff]/50"
                            role="switch"
                            aria-checked={isAnnual}
                        >
                            <span
                                className={cn(
                                    'pointer-events-none block h-5 w-5 rounded-full bg-[#2962ff] shadow-lg ring-0 transition-transform',
                                    isAnnual ? 'translate-x-5' : 'translate-x-0'
                                )}
                            />
                        </button>
                        <span className={cn('text-sm font-medium transition-colors', isAnnual ? 'text-white' : 'text-[#787b86]')}>
                            Annually <span className="text-[#2962ff] ml-1 text-xs font-bold">SAVE 20%</span>
                        </span>
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="grid gap-8 lg:grid-cols-3 lg:gap-8">
                    {isLoading && (
                        <div className="col-span-3 flex justify-center py-16">
                            <Loader2 className="w-7 h-7 animate-spin text-[#2962ff]" />
                        </div>
                    )}
                    {plans.map((plan) => (
                        <div
                            key={plan.id}
                            className={cn(
                                'relative flex flex-col rounded-2xl p-8 transition-all hover:translate-y-[-4px]',
                                plan.highlight
                                    ? 'bg-[#080808] border-2 border-[#2862ff] shadow-[0_0_50px_-10px_rgba(40,98,255,0.35)]'
                                    : 'bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.12]'
                            )}
                        >
                            {plan.highlight && (
                                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-[#2962ff] to-[#d236f9] px-4 py-1 text-xs font-bold uppercase tracking-wide text-white shadow-lg whitespace-nowrap">
                                    Most Popular
                                </div>
                            )}

                            <div className="mb-8">
                                <h3 className="text-xl font-bold text-white mb-2">{plan.name}</h3>
                                <div className="flex items-baseline gap-1 mb-1">
                                    <span className="text-4xl font-bold text-white">
                                        ${isAnnual ? plan.price.yearly : plan.price.monthly}
                                    </span>
                                    {plan.price.monthly > 0 && (
                                        <span className="text-sm text-[#787b86]">/mo</span>
                                    )}
                                </div>
                                {isAnnual && plan.price.yearlyTotal > 0 && (
                                    <p className="text-xs text-[#787b86] mb-2">Billed ${plan.price.yearlyTotal}/year</p>
                                )}
                                <p className="text-sm text-[#787b86] leading-relaxed mt-2">{plan.description}</p>
                            </div>

                            <Link
                                href={plan.id === 'premium' ? '/contact' : '/signup'}
                                className={cn(
                                    'w-full py-3.5 rounded-xl font-bold text-center transition-all duration-200 mb-8 block',
                                    plan.highlight
                                        ? 'bg-gradient-to-r from-[#2962ff] to-[#00bceb] text-white hover:brightness-110'
                                        : 'bg-white/[0.05] text-white hover:bg-white/[0.08] border border-white/[0.08]'
                                )}
                            >
                                {plan.cta}
                            </Link>

                            <ul className="space-y-3 flex-1">
                                {plan.features.map((feature) => (
                                    <li key={feature} className="flex items-start gap-3">
                                        <div className={cn(
                                            'mt-0.5 rounded-full p-0.5 flex-shrink-0',
                                            plan.highlight ? 'bg-[#2862ff]/20 text-[#2862ff]' : 'bg-white/[0.06] text-[#b2b5be]'
                                        )}>
                                            <Check className="w-3.5 h-3.5" />
                                        </div>
                                        <span className="text-sm text-[#d1d4dc]">{feature}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                <div className="text-center mt-10">
                    <Link href="/pricing" className="text-sm text-[#2962ff] hover:text-[#5585ff] transition-colors underline underline-offset-4">
                        View full plan comparison →
                    </Link>
                </div>
            </div>
        </section>
    );
}

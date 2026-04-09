'use client';

import { useState } from 'react';
import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export function PricingSection() {
    const [isAnnual, setIsAnnual] = useState(true);

    return (
        <section className="bg-background py-24 text-foreground" id="pricing">
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
                {/* Header */}
                <div className="mb-16 text-center">
                    <h2 className="text-4xl font-bold tracking-tight text-foreground mb-6 md:text-5xl">
                        Select your plan
                    </h2>
                    <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-10">
                        No commitment. Cancel anytime.
                    </p>

                    {/* Toggle */}
                    <div className="flex items-center justify-center gap-4">
                        <span className={cn("text-sm font-medium transition-colors", !isAnnual ? "text-foreground" : "text-muted-foreground")}>
                            Monthly
                        </span>
                        <button
                            onClick={() => setIsAnnual(!isAnnual)}
                            className="relative h-7 w-12 rounded-full bg-secondary p-1 transition-colors hover:bg-secondary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            role="switch"
                            aria-checked={isAnnual}
                        >
                            <span
                                className={cn(
                                    "pointer-events-none block h-5 w-5 rounded-full bg-foreground shadow-lg ring-0 transition-transform",
                                    isAnnual ? "translate-x-5" : "translate-x-0"
                                )}
                            />
                        </button>
                        <span className={cn("text-sm font-medium transition-colors", isAnnual ? "text-foreground" : "text-muted-foreground")}>
                            Annually <span className="text-primary ml-1">Save up to 16%</span>
                        </span>
                    </div>
                </div>

                {/* Pricing Cards */}
                <div className="grid gap-8 lg:grid-cols-3 lg:gap-8">
                    {/* Essential Plan */}
                    <PricingCard
                        title="Essential"
                        price={isAnnual ? 12.95 : 14.95}
                        prevPrice={isAnnual ? 155.40 : undefined}
                        description="Distraction-free trading and investing, with more charts, intervals and indicators."
                        features={[
                            "2 charts per tab",
                            "5 indicators per chart",
                            "10K historical bars",
                            "20 price alerts",
                            "20 technical alerts",
                            "No ads"
                        ]}
                    />

                    {/* Plus Plan (Highlighted) */}
                    <PricingCard
                        title="Plus"
                        price={isAnnual ? 24.95 : 29.95}
                        prevPrice={isAnnual ? 299.40 : undefined}
                        description="Intraday technical analysis for day traders looking to take things to the next level."
                        features={[
                            "4 charts per tab",
                            "10 indicators per chart",
                            "10K historical bars",
                            "100 price alerts",
                            "100 technical alerts",
                            "Intraday exotic charts",
                            "Charts based on custom formulas",
                            "Chart data export"
                        ]}
                        isPopular
                    />

                    {/* Premium Plan */}
                    <PricingCard
                        title="Premium"
                        price={isAnnual ? 49.95 : 59.95}
                        prevPrice={isAnnual ? 599.40 : undefined}
                        description="Highest precision and maximum data to capture every possible opportunity."
                        features={[
                            "8 charts per tab",
                            "25 indicators per chart",
                            "20K historical bars",
                            "400 price alerts",
                            "400 technical alerts",
                            "Second-based intervals",
                            "Alerts that don't expire",
                            "4x more data flow (fastest)",
                            "Publishing invite-only scripts"
                        ]}
                    />
                </div>
            </div>
        </section>
    );
}

interface PricingCardProps {
    title: string;
    price: number;
    prevPrice?: number;
    description: string;
    features: string[];
    isPopular?: boolean;
}

function PricingCard({ title, price, prevPrice, description, features, isPopular }: PricingCardProps) {
    return (
        <div className={cn(
            "relative flex flex-col rounded-2xl bg-card p-8 shadow-sm transition-all hover:translate-y-[-4px]",
            isPopular ? "border-2 border-primary" : "border border-border"
        )}>
            {isPopular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-primary px-4 py-1 text-xs font-semibold uppercase tracking-wide text-primary-foreground">
                    Best Value
                </div>
            )}

            <div className="mb-8">
                <h3 className="text-2xl font-bold text-foreground text-center mb-2">{title}</h3>
                <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold text-foreground">${price}</span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                </div>
                {prevPrice && (
                    <div className="text-center text-sm text-muted-foreground mt-1 line-through">
                        ${(prevPrice / 12).toFixed(2)} /mo
                    </div>
                )}
            </div>

            <div className="mb-8 flex justify-center">
                <Button
                    className={cn(
                        "w-full rounded-full py-6 text-base font-semibold transition-all duration-200",
                        isPopular
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                    )}
                >
                    Try free for 30 days
                </Button>
            </div>

            <ul className="mb-8 space-y-4 flex-1">
                {features.map((feature) => (
                    <li key={feature} className="flex items-start">
                        <Check className="mr-3 h-5 w-5 shrink-0 text-primary" />
                        <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                ))}
            </ul>

            <div className="mt-auto pt-6 border-t border-border text-xs text-muted-foreground text-center">
                Note: This is a simulation.
            </div>

        </div>
    );
}

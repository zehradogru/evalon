import { HeroSection } from './hero-section';
import { MarketOverviewSection } from './market-overview-section';
import { PricingSection } from './pricing-section';
import { LandingNavbar } from './landing-navbar';
import { Footer } from '@/features/landing/footer';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#131722] text-[#d1d4dc] font-sans selection:bg-[#2962ff] selection:text-white">
      <LandingNavbar />

      <main>
        <HeroSection />
        <MarketOverviewSection />
        <PricingSection />
      </main>

      <Footer />
    </div>
  );
}

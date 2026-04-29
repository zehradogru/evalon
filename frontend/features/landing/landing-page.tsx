import { HeroSection } from './hero-section';
import { MarketOverviewSection } from './market-overview-section';
import { PricingSection } from './pricing-section';
import { FeaturesSection } from './features-section';
import { CTASection } from './cta-section';
import { LandingNavbar } from './landing-navbar';
import { Footer } from '@/features/landing/footer';
import { GlobalSection } from './global-section';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-black text-[#d1d4dc] font-sans selection:bg-[#2862ff] selection:text-white">
      <LandingNavbar />

      <main>
        <HeroSection />
        <MarketOverviewSection />
        <FeaturesSection />
        <GlobalSection />
        <PricingSection />
        <CTASection />
      </main>

      <Footer />
    </div>
  );
}

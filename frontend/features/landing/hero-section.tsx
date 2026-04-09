'use client'

import Link from 'next/link'

// Pre-computed star positions to avoid hydration mismatch
const stars = [
  { x: 5, y: 8, s: 1, d: 0 }, { x: 12, y: 15, s: 1.5, d: 0.5 }, { x: 25, y: 5, s: 1, d: 1.2 },
  { x: 35, y: 20, s: 2, d: 0.3 }, { x: 45, y: 8, s: 1, d: 1.8 }, { x: 55, y: 18, s: 1.5, d: 0.7 },
  { x: 65, y: 3, s: 1, d: 2.1 }, { x: 75, y: 12, s: 2, d: 0.1 }, { x: 85, y: 6, s: 1, d: 1.5 },
  { x: 92, y: 22, s: 1.5, d: 0.9 }, { x: 8, y: 35, s: 1, d: 2.5 }, { x: 18, y: 42, s: 1.5, d: 0.4 },
  { x: 30, y: 38, s: 1, d: 1.1 }, { x: 42, y: 30, s: 2, d: 1.7 }, { x: 58, y: 35, s: 1, d: 0.2 },
  { x: 68, y: 28, s: 1.5, d: 2.3 }, { x: 78, y: 40, s: 1, d: 0.6 }, { x: 88, y: 32, s: 2, d: 1.4 },
  { x: 3, y: 55, s: 1, d: 1.9 }, { x: 15, y: 60, s: 1.5, d: 0.8 }, { x: 22, y: 48, s: 1, d: 2.7 },
  { x: 38, y: 52, s: 2, d: 0.2 }, { x: 48, y: 58, s: 1, d: 1.6 }, { x: 60, y: 50, s: 1.5, d: 2.0 },
  { x: 72, y: 55, s: 1, d: 0.5 }, { x: 82, y: 48, s: 2, d: 1.3 }, { x: 95, y: 52, s: 1, d: 2.8 },
  { x: 10, y: 70, s: 1.5, d: 0.3 }, { x: 28, y: 65, s: 1, d: 1.0 }, { x: 50, y: 72, s: 2, d: 2.2 },
  { x: 70, y: 68, s: 1, d: 0.7 }, { x: 90, y: 75, s: 1.5, d: 1.8 }, { x: 40, y: 78, s: 1, d: 2.4 },
  { x: 16, y: 82, s: 2, d: 0.1 }, { x: 62, y: 80, s: 1, d: 1.5 }, { x: 80, y: 85, s: 1.5, d: 2.6 },
]

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* === Background Image === */}
      <div className="absolute inset-0 z-0 bg-background overflow-hidden">
        {/* Animated Gradient Blobs */}
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-900/20 blur-[120px] animate-pulse" style={{ animationDuration: '4s' }} />
        <div className="absolute top-[20%] right-[-10%] w-[40%] h-[60%] rounded-full bg-indigo-900/20 blur-[120px] animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />
        <div className="absolute bottom-[-10%] left-[20%] w-[60%] h-[40%] rounded-full bg-blue-800/20 blur-[120px] animate-pulse" style={{ animationDuration: '5s', animationDelay: '2s' }} />

        {/* Grid Pattern */}
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-[0.03]" />

        {/* Aurora Effect (using existing animation if available, or custom styles) */}
        <div className="absolute inset-0 opacity-30">
          <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob" />
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-2000" />
          <div className="absolute -bottom-32 left-1/3 w-96 h-96 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-blob animation-delay-4000" />
        </div>

        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background" />
      </div>

      {/* === Content === */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 text-center pt-32 pb-20">

        {/* Headline */}
        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-[72px] font-bold text-foreground leading-[1.1] tracking-tighter mb-6 max-w-4xl mx-auto">
          Look first / <br />
          <span className="text-foreground">Then leap.</span>
        </h1>

        {/* Subtitle */}
        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto mb-10 leading-relaxed font-light">
          The best trades require research, then commitment. <br />
          Evalon is where the world charts, chats and trades markets.
        </p>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center px-8 py-3 text-base font-semibold text-background bg-foreground rounded-full hover:bg-foreground/90 transition-all duration-200 min-w-[180px]"
          >
            Get started
          </Link>
        </div>

        {/* Trust metrics */}
        <div className="flex flex-wrap items-center justify-center gap-x-12 gap-y-8 mt-20 pt-10 border-t border-border/50">
          <div className="text-center">
            <div className="text-3xl font-bold text-foreground">50M+</div>
            <div className="text-sm text-muted-foreground mt-1">Traders and investors</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-foreground">#1</div>
            <div className="text-sm text-muted-foreground mt-1">Top website in the world for all things investing</div>
          </div>

          <div className="text-center">
            <div className="text-3xl font-bold text-foreground">4.9</div>
            <div className="text-sm text-muted-foreground mt-1">Mobile rating</div>
          </div>
        </div>
      </div>
    </section>
  )
}

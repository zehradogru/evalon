'use client'

export function SplashScreen() {
  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-[#131722]">
      {/* Ambient glow */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#2962ff]/5 blur-[120px]" />
      </div>

      <div className="relative flex flex-col items-center gap-8">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="relative h-12 w-12 rounded-xl bg-gradient-to-br from-[#2962ff] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#2962ff]/20">
            <span className="text-white text-xl font-bold">E</span>
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-white/10 to-transparent" />
          </div>
          <span className="text-white text-3xl font-bold tracking-tight">
            EVALON
          </span>
        </div>

        {/* Loading bar */}
        <div className="w-48 h-[2px] bg-[#2a2e39] rounded-full overflow-hidden">
          <div className="h-full bg-gradient-to-r from-[#2962ff] to-[#7c3aed] rounded-full animate-loading-bar" />
        </div>

        {/* Tagline */}
        <p className="text-[#787b86] text-sm tracking-wider uppercase">
          AI-Powered Trading Platform
        </p>
      </div>
    </div>
  )
}

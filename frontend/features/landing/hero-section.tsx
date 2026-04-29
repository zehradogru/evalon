'use client'

import Link from 'next/link'
import { ArrowRight, BarChart2, Zap, Globe } from 'lucide-react'

const BADGES = [
  { icon: BarChart2, text: 'Real-time Charts' },
  { icon: Zap, text: 'AI-Powered Signals' },
  { icon: Globe, text: '100+ Global Markets' },
]

const BG_CANDLES = [
  { x: 30,  mid: 310, up: true  },
  { x: 74,  mid: 290, up: false },
  { x: 118, mid: 274, up: true  },
  { x: 162, mid: 255, up: true  },
  { x: 206, mid: 240, up: false },
  { x: 250, mid: 252, up: false },
  { x: 294, mid: 228, up: true  },
  { x: 338, mid: 210, up: true  },
  { x: 382, mid: 196, up: false },
  { x: 426, mid: 183, up: true  },
  { x: 470, mid: 166, up: true  },
  { x: 514, mid: 150, up: false },
  { x: 558, mid: 138, up: true  },
  { x: 602, mid: 126, up: false },
  { x: 646, mid: 106, up: true  },
  { x: 690, mid: 90,  up: true  },
  { x: 734, mid: 76,  up: false },
  { x: 778, mid: 60,  up: true  },
]

export function HeroSection() {
  const chartLine = 'M0,330 C60,308 90,284 140,258 C190,232 215,248 262,222 C312,196 342,172 402,148 C452,126 492,140 542,112 C592,88 632,72 692,52 C742,36 772,28 820,16'
  const chartArea = `${chartLine} L820,430 L0,430 Z`

  return (
    <section className="relative h-screen max-h-screen flex flex-col overflow-hidden bg-black">

      {/* ── BACKGROUND ── */}

      {/* Dot grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.022]"
        style={{ backgroundImage: 'radial-gradient(circle, #ffffff 1px, transparent 1px)', backgroundSize: '30px 30px' }}
      />

      {/* Horizontal price-grid lines */}
      <div className="absolute inset-0 pointer-events-none">
        {[22, 38, 54, 70, 86].map((pct) => (
          <div key={pct} className="absolute w-full h-px bg-white/[0.025]" style={{ top: `${pct}%` }} />
        ))}
      </div>

      {/* Rising chart art – full-background SVG */}
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none opacity-[0.13]"
        viewBox="0 0 820 430"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="heroAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2862ff" stopOpacity={1} />
            <stop offset="85%" stopColor="#2862ff" stopOpacity={0.08} />
            <stop offset="100%" stopColor="#2862ff" stopOpacity={0} />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={chartArea} fill="url(#heroAreaGrad)" />
        {/* Trend line */}
        <path d={chartLine} fill="none" stroke="#2862ff" strokeWidth="2.5" strokeLinecap="round" />
        {/* Candlestick bars */}
        {BG_CANDLES.map(({ x, mid, up }) => (
          <g key={x}>
            <line
              x1={x} y1={mid - 18} x2={x} y2={mid + 18}
              stroke={up ? '#089981' : '#f23645'} strokeWidth={1.5} opacity={0.75}
            />
            <rect
              x={x - 7} y={up ? mid - 14 : mid} width={14} height={14} rx={2}
              fill={up ? '#089981' : '#f23645'} opacity={0.85}
            />
          </g>
        ))}
      </svg>

      {/* Glow bloom – behind headline */}
      <div className="absolute top-[6%] left-1/2 -translate-x-1/2 w-[720px] h-[380px] rounded-full bg-[#2862ff]/10 blur-[130px] pointer-events-none" />
      <div className="absolute top-[10%] left-1/2 -translate-x-1/2 w-[420px] h-[240px] rounded-full bg-[#7c3aed]/7 blur-[90px] pointer-events-none" />

      {/* Bottom fade so it blends into next section */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black to-transparent pointer-events-none" />

      {/* ── CONTENT ── */}
      <div className="relative z-10 flex flex-col items-center justify-center w-full h-full max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-8">

        {/* Text block – centered */}
        <div className="text-center max-w-3xl mx-auto animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2862ff]/10 border border-[#2862ff]/25 mb-5">
            <span className="w-1.5 h-1.5 rounded-full bg-[#2862ff] animate-pulse" />
            <span className="text-xs font-semibold text-[#2862ff] tracking-widest uppercase">AI-Powered Trading Platform</span>
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-[58px] font-bold text-white leading-[1.05] tracking-tight mb-4">
            Look first /
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#2862ff] via-[#5a8bff] to-[#7c3aed]">
              Then leap.
            </span>
          </h1>

          <p className="text-base sm:text-lg text-[#787b86] leading-relaxed mb-6 max-w-xl mx-auto">
            The best trades require research, then commitment.
            Evalon is where the world charts, chats and trades markets.
          </p>

          <div className="flex flex-wrap justify-center gap-2 mb-6">
            {BADGES.map(({ icon: Icon, text }) => (
              <div
                key={text}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-[#b2b5be]"
              >
                <Icon className="w-3.5 h-3.5 text-[#2862ff]" />
                {text}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl text-sm font-semibold text-white bg-[#2862ff] hover:bg-[#1e53e5] transition-all duration-200 shadow-lg shadow-[#2862ff]/25 hover:shadow-[#2862ff]/35 hover:scale-[1.02] active:scale-[0.98]"
            >
              Create Free Account
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>

      </div>
    </section>
  )
}

import React from 'react'

const CANDLES: { b: string; h: string; wb: string; wh: string; delay: string }[] = [
  { b: '7.1%',   h: '18.93%', wb: '0%',     wh: '31.95%', delay: '0s' },
  { b: '26.04%', h: '2.37%',  wb: '19.41%', wh: '14.91%', delay: '0.065s' },
  { b: '28.64%', h: '4.5%',   wb: '16.92%', wh: '21.66%', delay: '0.13s' },
  { b: '31.42%', h: '3.43%',  wb: '19.76%', wh: '27.93%', delay: '0.195s' },
  { b: '31.42%', h: '15.44%', wb: '27.43%', wh: '28.07%', delay: '0.26s' },
  { b: '46.54%', h: '0.28%',  wb: '43.43%', wh: '24.38%', delay: '0.325s' },
  { b: '35.86%', h: '8.7%',   wb: '29.7%',  wh: '24.5%',  delay: '0.39s' },
  { b: '11.67%', h: '24.19%', wb: '5.33%',  wh: '31.83%', delay: '0.455s' },
  { b: '11.83%', h: '15.1%',  wb: '7.93%',  wh: '24.97%', delay: '0.52s' },
  { b: '27.81%', h: '12.04%', wb: '27.69%', wh: '28.17%', delay: '0.585s' },
  { b: '39.85%', h: '28.25%', wb: '39.53%', wh: '28.58%', delay: '0.65s' },
  { b: '70.8%',  h: '6.27%',  wb: '60.96%', wh: '24.84%', delay: '0.715s' },
  { b: '75.8%',  h: '2.71%',  wb: '68.38%', wh: '31.62%', delay: '0.78s' },
  { b: '67.23%', h: '8.71%',  wb: '64.8%',  wh: '24.97%', delay: '0.845s' },
  { b: '67.81%', h: '7.85%',  wb: '57.54%', wh: '27.55%', delay: '0.91s' },
  { b: '70.08%', h: '6.14%',  wb: '55.68%', wh: '21.83%', delay: '0.975s' },
  { b: '66.39%', h: '3.69%',  wb: '58.11%', wh: '26.11%', delay: '1.04s' },
  { b: '64.8%',  h: '9.78%',  wb: '45.47%', wh: '29.61%', delay: '1.105s' },
]

interface CandleLoaderProps {
  /** Wrap in a full-screen centering container */
  fullscreen?: boolean
  className?: string
}

export function CandleLoader({ fullscreen = false, className }: CandleLoaderProps) {
  const bars = (
    <div className={`flex items-end gap-1 ${className ?? ''}`} style={{ height: 80 }}>
      {CANDLES.map((c, i) => (
        <div
          key={i}
          className="candle-bar"
          style={
            {
              '--b': c.b,
              '--h': c.h,
              '--wb': c.wb,
              '--wh': c.wh,
              animationDelay: c.delay,
            } as React.CSSProperties
          }
        />
      ))}
    </div>
  )

  if (fullscreen) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-black">
        {bars}
        <span className="text-sm text-[#787b86] tracking-widest uppercase">Loading…</span>
      </div>
    )
  }

  return bars
}

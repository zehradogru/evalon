'use client'

import { useState } from 'react'
import { Heart, SmilePlus } from 'lucide-react'
import { cn } from '@/lib/utils'

const moods = [
  { emoji: '😎', label: 'Confident', value: 'confident' },
  { emoji: '😰', label: 'Anxious', value: 'anxious' },
  { emoji: '🤔', label: 'Uncertain', value: 'uncertain' },
  { emoji: '😤', label: 'FOMO', value: 'fomo' },
  { emoji: '🧘', label: 'Calm', value: 'calm' },
  { emoji: '🎯', label: 'Focused', value: 'focused' },
]

export function BehavioralCheckin() {
  const [selected, setSelected] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)

  const handleSelect = (value: string) => {
    setSelected(value)
    setSubmitted(true)
    // Reset after 3 seconds to allow re-selection
    setTimeout(() => setSubmitted(false), 3000)
  }

  return (
    <div className="rounded-xl bg-card border border-border overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border/50">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#f23645]/10 flex items-center justify-center">
            <Heart className="h-4 w-4 text-[#f23645]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Mood Check-in</h3>
            <p className="text-[10px] text-muted-foreground">How are you feeling?</p>
          </div>
        </div>
        <SmilePlus className="h-4 w-4 text-muted-foreground" />
      </div>

      {/* Content */}
      <div className="flex-1 p-4 flex flex-col">
        {submitted && selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="text-4xl mb-3">
              {moods.find((m) => m.value === selected)?.emoji}
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              Feeling {moods.find((m) => m.value === selected)?.label}
            </p>
            <p className="text-[11px] text-muted-foreground max-w-[180px]">
              {selected === 'fomo' && 'Be cautious — FOMO often leads to impulsive decisions.'}
              {selected === 'anxious' && 'Consider reducing position sizes today.'}
              {selected === 'confident' && 'Great mindset! Stay disciplined with your strategy.'}
              {selected === 'uncertain' && 'Stick to high-conviction setups only.'}
              {selected === 'calm' && 'Perfect state for objective analysis.'}
              {selected === 'focused' && 'Channel that focus into your best setups.'}
            </p>
            <div className="mt-3 px-2.5 py-1 rounded-full bg-[#089981]/10 text-[10px] text-[#089981] font-medium">
              ✓ Logged at {new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-4 text-center">
              Track your emotional state before trading
            </p>
            <div className="grid grid-cols-3 gap-2 flex-1">
              {moods.map((mood) => (
                <button
                  key={mood.value}
                  onClick={() => handleSelect(mood.value)}
                  className={cn(
                    "flex flex-col items-center justify-center gap-1.5 rounded-lg border transition-all duration-200 hover:scale-105 active:scale-95",
                    selected === mood.value
                      ? "bg-primary/10 border-primary/30"
                      : "bg-background border-border/50 hover:border-border"
                  )}
                >
                  <span className="text-2xl">{mood.emoji}</span>
                  <span className="text-[10px] text-muted-foreground font-medium">{mood.label}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

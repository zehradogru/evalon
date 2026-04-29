'use client'

import Link from 'next/link'
import { Search, Menu, X, User, ChevronRight } from 'lucide-react'
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'
import { BIST_AVAILABLE, TICKER_NAMES } from '@/config/markets'
import { cn } from '@/lib/utils'

const SEARCH_INDEX = BIST_AVAILABLE.map(ticker => ({
  ticker,
  name: TICKER_NAMES[ticker] || ticker,
  searchStr: `${ticker.toLowerCase()} ${(TICKER_NAMES[ticker] || '').toLowerCase()}`,
}))

function LandingSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const results = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    return SEARCH_INDEX.filter(item => item.searchStr.includes(q)).slice(0, 8)
  }, [query])

  const handleSelect = useCallback((ticker: string) => {
    router.push(`/login?redirect=/markets/${ticker}`)
    setQuery('')
    setIsOpen(false)
  }, [router])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      e.preventDefault()
      handleSelect(results[selectedIndex].ticker)
    } else if (e.key === 'Escape') {
      setIsOpen(false)
      inputRef.current?.blur()
    }
  }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  return (
    <div ref={containerRef} className="relative hidden sm:block">
      <div className="flex items-center gap-3 px-4 py-2.5 rounded-full bg-white/[0.05] hover:bg-white/[0.08] border border-white/[0.06] hover:border-white/[0.1] text-[#787b86] hover:text-[#d1d4dc] transition-all min-w-[200px] group">
        <Search className="w-4 h-4 group-hover:text-white transition-colors flex-shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setSelectedIndex(0); setIsOpen(true) }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Search ticker..."
          className="bg-transparent text-sm text-[#d1d4dc] placeholder:text-[#787b86] outline-none w-full"
        />
        <span className="ml-auto text-xs px-1.5 py-0.5 rounded border border-white/10 text-[#787b86] flex-shrink-0">&#8984;K</span>
      </div>

      {isOpen && results.length > 0 && (
        <div className="absolute top-[calc(100%+6px)] left-0 w-72 bg-[#0d0d0d] border border-white/[0.08] shadow-2xl rounded-xl py-1 z-50">
          {results.map((item, i) => (
            <div
              key={item.ticker}
              onClick={() => handleSelect(item.ticker)}
              onMouseEnter={() => setSelectedIndex(i)}
              className={cn(
                'flex items-center justify-between px-3 py-2.5 cursor-pointer transition-colors',
                i === selectedIndex ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
              )}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="text-xs font-bold text-white w-14 flex-shrink-0">{item.ticker}</span>
                <span className="text-xs text-[#787b86] truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <span className="text-[10px] text-[#787b86]">BIST</span>
                <ChevronRight className="w-3 h-3 text-[#787b86]" />
              </div>
            </div>
          ))}
          <div className="px-3 py-2 border-t border-white/[0.06] text-[10px] text-[#787b86]">
            Sign in to view full chart
          </div>
        </div>
      )}

      {isOpen && query.trim().length > 0 && results.length === 0 && (
        <div className="absolute top-[calc(100%+6px)] left-0 w-72 bg-[#0d0d0d] border border-white/[0.08] shadow-2xl rounded-xl py-3 z-50">
          <p className="text-xs text-[#787b86] text-center">No results found</p>
        </div>
      )}
    </div>
  )
}

const navLinks = [
  { label: 'Products', href: '/pricing' },
  { label: 'Community', href: '/community' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Features', href: '/#features' },
  { label: 'Learn', href: '/academy' },
]

export function LandingNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isScrolled, setIsScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav className={cn(
      'fixed top-0 left-0 right-0 z-50 py-2 transition-all duration-300',
      isScrolled
        ? 'bg-black/80 backdrop-blur-xl border-b border-white/[0.06] shadow-[0_1px_60px_rgba(0,0,0,0.9)]'
        : 'bg-transparent'
    )}>
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">

        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2962ff] to-[#0d47a1] flex items-center justify-center text-white font-bold">
              E
            </div>
            <span className="text-xl font-bold tracking-tight text-white hidden sm:block">
              EVALON
            </span>
          </Link>

          <LandingSearch />

          <div className="hidden lg:flex items-center gap-6 text-[15px] font-medium text-[#d1d4dc] ml-2">
            {navLinks.map(link => (
              <Link key={link.label} href={link.href} className="hover:text-white transition-colors">
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button className="sm:hidden text-white">
            <Search className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full hover:bg-white/[0.07] transition-colors text-white outline-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-[#0d0d0d] border-white/[0.08] text-[#d1d4dc] p-2 mt-2 shadow-2xl backdrop-blur-3xl rounded-xl">
                <DropdownMenuItem className="focus:bg-white/[0.07] focus:text-white cursor-pointer p-0 mb-1 rounded-lg outline-none border-none">
                  <Link href="/login" className="flex items-center gap-3 w-full px-3 py-3 group">
                    <User strokeWidth={2} size={24} className="text-[#2962ff]" />
                    <span className="font-medium text-white text-[16px] group-hover:text-[#2962ff] transition-colors">Sign in</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-white/[0.06] my-1" />

                <DropdownMenuItem asChild className="focus:bg-white/[0.07] focus:text-white cursor-pointer py-3 px-3 rounded-lg outline-none text-[15px]">
                  <Link href="/help">Help Center</Link>
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-white/[0.07] focus:text-white cursor-pointer py-3 px-3 rounded-lg outline-none text-[15px]">
                  {"What's new"}
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-white/[0.06] my-1" />

                <div className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-white/[0.07] transition-colors cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[15px] text-white">Dark theme</span>
                  <Switch checked={true} className="data-[state=checked]:bg-[#2962ff] border-2 border-transparent" />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-6 py-2.5 text-[15px] font-bold text-white bg-[#2962ff] rounded-full hover:bg-[#1e53e5] transition-all"
            >
              See Pricing
            </Link>
          </div>

          <button
            className="lg:hidden text-white ml-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {isMenuOpen && (
        <div className="lg:hidden absolute top-20 left-4 right-4 bg-black/90 backdrop-blur-xl border border-white/[0.07] rounded-2xl p-4 flex flex-col gap-4 shadow-2xl">
          {navLinks.map(link => (
            <Link
              key={link.label}
              href={link.href}
              onClick={() => setIsMenuOpen(false)}
              className="text-[#d1d4dc] hover:text-white font-medium py-2 px-2 hover:bg-white/5 rounded-lg transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="h-px bg-white/[0.06] my-1" />
          <Link href="/login" onClick={() => setIsMenuOpen(false)} className="text-white font-semibold py-2 px-2 hover:bg-white/5 rounded-lg transition-colors">Log In</Link>
        </div>
      )}
    </nav>
  )
}

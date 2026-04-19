'use client'

import Link from 'next/link'
import { Search, Menu, X, User } from 'lucide-react'
import { useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Switch } from '@/components/ui/switch'

export function LandingNavbar() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-transparent py-2">
      <div className="max-w-[1400px] mx-auto px-4 lg:px-6 h-16 flex items-center justify-between">

        {/* Left Section: Logo & Search */}
        <div className="flex items-center gap-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#2962ff] to-[#0d47a1] flex items-center justify-center text-white font-bold">
              E
            </div>
            <span className="text-xl font-bold tracking-tight text-white hidden sm:block">
              EVALON
            </span>
          </Link>

          {/* Search Button (Desktop) - Moved to Left */}
          <button className="hidden sm:flex items-center gap-3 px-4 py-2.5 rounded-full bg-[#1e222d] hover:bg-[#2a2e39] text-[#787b86] hover:text-[#d1d4dc] transition-all min-w-[200px] group text-left">
            <Search className="w-5 h-5 group-hover:text-white transition-colors" />
            <span className="text-base">Search</span>
            <span className="ml-auto text-xs px-1.5 py-0.5 rounded border border-[#2a2e39] text-[#787b86]">⌘K</span>
          </button>

          {/* Desktop Nav Links - Moved Next to Search */}
          <div className="hidden lg:flex items-center gap-6 text-[15px] font-medium text-[#d1d4dc] ml-2">
            <Link href="#products" className="hover:text-white transition-colors">Products</Link>
            <Link href="#community" className="hover:text-white transition-colors">Community</Link>
            <Link href="#pricing" className="hover:text-white transition-colors">Pricing</Link>
            <Link href="#features" className="hover:text-white transition-colors">Features</Link>
            <Link href="#learn" className="hover:text-white transition-colors">Learn</Link>
          </div>
        </div>

        {/* Right Section: Auth & Actions */}
        <div className="flex items-center gap-4">

          {/* Search Icon (Mobile) */}
          <button className="sm:hidden text-white">
            <Search className="w-5 h-5" />
          </button>

          {/* Auth Buttons */}
          <div className="flex items-center gap-4">

            {/* Profile Dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="hidden sm:flex items-center justify-center w-10 h-10 rounded-full hover:bg-[#2a2e39] transition-colors text-white outline-none">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 bg-[#1e222d] border-[#2a2e39] text-[#d1d4dc] p-2 mt-2 shadow-xl backdrop-blur-3xl rounded-xl">
                <DropdownMenuItem className="focus:bg-[#2a2e39] focus:text-white cursor-pointer p-0 mb-1 rounded-lg outline-none border-none">
                  <Link href="/login" className="flex items-center gap-3 w-full px-3 py-3 group">
                    <User strokeWidth={2} size={24} className="text-[#2962ff] group-hover:text-[#2962ff]" />
                    <span className="font-medium text-white text-[16px] group-hover:text-[#2962ff] transition-colors">Sign in</span>
                  </Link>
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-[#2a2e39] my-1" />

                <DropdownMenuItem className="focus:bg-[#2a2e39] focus:text-white cursor-pointer py-3 px-3 rounded-lg outline-none text-[15px]">
                  Help Center
                </DropdownMenuItem>
                <DropdownMenuItem className="focus:bg-[#2a2e39] focus:text-white cursor-pointer py-3 px-3 rounded-lg outline-none text-[15px]">
                  What&apos;s new
                </DropdownMenuItem>

                <DropdownMenuSeparator className="bg-[#2a2e39] my-1" />

                <div className="flex items-center justify-between px-3 py-3 rounded-lg hover:bg-[#2a2e39] transition-colors cursor-pointer" onClick={(e) => e.stopPropagation()}>
                  <span className="text-[15px] text-white">Dark theme</span>
                  <Switch checked={true} className="data-[state=checked]:bg-[#2962ff] border-2 border-transparent" />
                </div>
              </DropdownMenuContent>
            </DropdownMenu>

            <Link
              href="/pricing"
              className="inline-flex items-center justify-center px-6 py-2.5 text-[15px] font-bold text-white bg-[#2962ff] rounded-full hover:bg-[#1e53e5] transition-all"
            >
              Get started
            </Link>
          </div>

          {/* Mobile Menu Toggle */}
          <button
            className="lg:hidden text-white ml-2"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            {isMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {isMenuOpen && (
        <div className="lg:hidden absolute top-20 left-4 right-4 bg-[#131722]/95 backdrop-blur-xl border border-[#2a2e39] rounded-2xl p-4 flex flex-col gap-4 shadow-2xl">
          <Link href="#products" onClick={() => setIsMenuOpen(false)} className="text-[#d1d4dc] hover:text-white font-medium py-2 px-2 hover:bg-white/5 rounded-lg transition-colors">Products</Link>
          <Link href="#community" onClick={() => setIsMenuOpen(false)} className="text-[#d1d4dc] hover:text-white font-medium py-2 px-2 hover:bg-white/5 rounded-lg transition-colors">Community</Link>
          <Link href="#pricing" onClick={() => setIsMenuOpen(false)} className="text-[#d1d4dc] hover:text-white font-medium py-2 px-2 hover:bg-white/5 rounded-lg transition-colors">Pricing</Link>
          <Link href="#features" onClick={() => setIsMenuOpen(false)} className="text-[#d1d4dc] hover:text-white font-medium py-2 px-2 hover:bg-white/5 rounded-lg transition-colors">Features</Link>
          <Link href="#learn" onClick={() => setIsMenuOpen(false)} className="text-[#d1d4dc] hover:text-white font-medium py-2 px-2 hover:bg-white/5 rounded-lg transition-colors">Learn</Link>
          <div className="h-px bg-[#2a2e39] my-1" />
          <Link href="/login" onClick={() => setIsMenuOpen(false)} className="text-white font-semibold py-2 px-2 hover:bg-white/5 rounded-lg transition-colors">Log In</Link>
        </div>
      )}
    </nav>
  )
}

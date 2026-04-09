'use client'

import { usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  LayoutDashboard,
  BarChart3,
  Globe,
  Briefcase,
  Brain,
  Bell,
  Clock,
  Settings,
  HelpCircle,
  LogOut,
  Search,
} from 'lucide-react'
import { authService } from '@/services/auth.service'

const topNavItems = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/dashboard' },
  { icon: BarChart3, label: 'Charts', href: '/dashboard/charts' },
  { icon: Globe, label: 'Markets', href: '/dashboard/markets' },
  { icon: Briefcase, label: 'Portfolio', href: '/dashboard/portfolio' },
  { icon: Brain, label: 'AI Signals', href: '/dashboard/ai-signals' },
  { icon: Search, label: 'Screener', href: '/dashboard/screener' },
]

const bottomNavItems = [
  { icon: Bell, label: 'Alerts', href: '/dashboard/alerts' },
  { icon: Clock, label: 'History', href: '/dashboard/history' },
  { icon: Settings, label: 'Settings', href: '/dashboard/settings' },
  { icon: HelpCircle, label: 'Help', href: '/help' },
]

export function Sidebar() {
  const pathname = usePathname()

  const handleLogout = async () => {
    await authService.logout()
  }

  return (
    <aside className="hidden md:flex flex-col w-[56px] bg-[#131722] border-r border-[#2a2e39] flex-shrink-0 h-full">
      {/* Logo */}
      <div className="flex items-center justify-center h-[56px] border-b border-[#2a2e39]">
        <Link href="/dashboard" className="flex items-center justify-center">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#2962ff] to-[#7c3aed] flex items-center justify-center hover:scale-105 transition-transform">
            <span className="text-white text-xs font-bold">E</span>
          </div>
        </Link>
      </div>

      {/* Top nav */}
      <div className="flex-1 flex flex-col items-center py-3 gap-1">
        {topNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-[#2962ff]/15 text-[#2962ff]'
                  : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-white/5'
              }`}
            >
              {/* Active indicator */}
              {isActive && (
                <div className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 bg-[#2962ff] rounded-r-full" />
              )}
              <Icon className="h-[18px] w-[18px]" />

              {/* Tooltip */}
              <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-[#131722] border border-[#2a2e39] text-xs text-[#d1d4dc] font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl shadow-black/20 pointer-events-none">
                {item.label}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-[#131722] border-l border-b border-[#2a2e39] rotate-45" />
              </div>
            </Link>
          )
        })}
      </div>

      {/* Divider */}
      <div className="mx-3 h-px bg-[#2a2e39]" />

      {/* Bottom nav */}
      <div className="flex flex-col items-center py-3 gap-1">
        {bottomNavItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`group relative flex items-center justify-center w-10 h-10 rounded-lg transition-all duration-200 ${
                isActive
                  ? 'bg-[#2962ff]/15 text-[#2962ff]'
                  : 'text-[#787b86] hover:text-[#d1d4dc] hover:bg-white/5'
              }`}
            >
              <Icon className="h-[18px] w-[18px]" />
              <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-[#131722] border border-[#2a2e39] text-xs text-[#d1d4dc] font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl shadow-black/20 pointer-events-none">
                {item.label}
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-[#131722] border-l border-b border-[#2a2e39] rotate-45" />
              </div>
            </Link>
          )
        })}

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="group relative flex items-center justify-center w-10 h-10 rounded-lg text-[#787b86] hover:text-[#f23645] hover:bg-[#f23645]/10 transition-all duration-200"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <div className="absolute left-full ml-3 px-2.5 py-1.5 rounded-lg bg-[#131722] border border-[#2a2e39] text-xs text-[#d1d4dc] font-medium whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 shadow-xl shadow-black/20 pointer-events-none">
            Logout
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-[#131722] border-l border-b border-[#2a2e39] rotate-45" />
          </div>
        </button>
      </div>
    </aside>
  )
}

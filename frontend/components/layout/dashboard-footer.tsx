'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const columns = {
  Tools: [
    { label: 'Dashboard', href: '/' },
    { label: 'Backtesting', href: '/backtest' },
    { label: 'Screener', href: '/screener' },
    { label: 'Paper Trading', href: '/paper-trade' },
    { label: 'Evalon AI', href: '/ai' },
    { label: 'Strategy Builder', href: '/strategy' },
  ],
  Markets: [
    { label: 'Market Overview', href: '/markets' },
    { label: 'Watchlist', href: '/watchlist' },
    { label: 'Top Movers', href: '/markets/movers' },
    { label: 'News Feed', href: '/news' },
    { label: 'Brokers', href: '/brokers' },
  ],
  Account: [
    { label: 'Upgrade Plan', href: '/pricing' },
    { label: 'Community', href: '/community' },
    { label: 'Academy', href: '/academy' },
    { label: 'Settings', href: '/settings' },
  ],
  Support: [
    { label: 'Help Center', href: '/help' },
    { label: 'Contact Us', href: '/contact' },
    { label: 'Terms of Service', href: '/terms' },
    { label: 'Privacy Policy', href: '/privacy' },
  ],
}

export function DashboardFooter() {
  const pathname = usePathname()
  if (pathname === '/ai') return null

  return (
    <footer className="bg-background border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Main grid */}
        <div className="py-10 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-3 lg:col-span-1 mb-4 lg:mb-0">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground text-xs font-bold">E</span>
              </div>
              <span className="text-foreground text-sm font-bold tracking-tight">EVALON</span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed max-w-xs">
              AI-Powered Trading Platform for BIST, NASDAQ, Crypto &amp; Forex.
            </p>
          </div>

          {/* Link columns */}
          {Object.entries(columns).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">{title}</h4>
              <ul className="space-y-2">
                {links.map(link => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="py-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            &copy; {new Date().getFullYear()} EVALON. All rights reserved. Not financial advice.
          </p>
          <div className="flex items-center gap-4">
            {[
              { label: 'Twitter', href: 'https://twitter.com/evalonapp' },
              { label: 'Discord', href: 'https://discord.gg/evalon' },
              { label: 'Telegram', href: '#' },
            ].map(s => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

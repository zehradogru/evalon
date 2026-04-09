'use client'

import Link from 'next/link'

const footerLinks = {
  Products: [
    { label: 'Supercharts', href: '#' },
    { label: 'AI Alpha Picks', href: '#' },
    { label: 'Backtesting', href: '#' },
    { label: 'Screener', href: '#' },
    { label: 'API', href: '#' },
  ],
  Community: [
    { label: 'Ideas', href: '#' },
    { label: 'Scripts', href: '#' },
    { label: 'Streams', href: '#' },
    { label: 'Blog', href: '#' },
  ],
  Company: [
    { label: 'About', href: '#' },
    { label: 'Careers', href: '#' },
    { label: 'Press', href: '#' },
    { label: 'Contact', href: '#' },
  ],
  Legal: [
    { label: 'Terms', href: '/terms' },
    { label: 'Privacy', href: '/privacy' },
    { label: 'Cookies', href: '#' },
    { label: 'Help', href: '/help' },
  ],
}

export function Footer() {
  return (
    <footer className="bg-[#0d1117] border-t border-[#2a2e39]/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Main Footer */}
        <div className="py-12 sm:py-16 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-8">
          {/* Brand */}
          <div className="col-span-2 sm:col-span-4 lg:col-span-1 mb-4 lg:mb-0">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-[#2962ff] to-[#7c3aed] flex items-center justify-center">
                <span className="text-white text-sm font-bold">E</span>
              </div>
              <span className="text-white text-lg font-bold tracking-tight">EVALON</span>
            </Link>
            <p className="text-sm text-[#787b86] leading-relaxed max-w-xs">
              AI-Powered Trading Platform for BIST, NASDAQ, Crypto &amp; Forex markets.
            </p>
          </div>

          {/* Link Columns */}
          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold text-white mb-4">{title}</h4>
              <ul className="space-y-2.5">
                {links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-[#787b86] hover:text-[#d1d4dc] transition-colors"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom Bar */}
        <div className="py-6 border-t border-[#2a2e39]/50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-xs text-[#787b86]">
            &copy; {new Date().getFullYear()} EVALON. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            {['Twitter', 'Discord', 'Telegram', 'GitHub'].map((social) => (
              <a
                key={social}
                href="#"
                className="text-xs text-[#787b86] hover:text-[#d1d4dc] transition-colors"
              >
                {social}
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  )
}

'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { marketIndices } from '@/data/dashboard.mock'
import { fetchPrices } from '@/services/price.service'
import { TrendingUp, TrendingDown, BarChart2, ChevronRight, Activity } from 'lucide-react'

export function MarketOverviewSection() {
  const [chartData, setChartData] = useState<{ time: string; price: number }[]>([])

  useEffect(() => {
    fetchPrices({ ticker: 'XU100', timeframe: '1d', limit: 90 })
      .then(res =>
        setChartData(
          res.data.map(b => ({
            time: new Date(b.t).toLocaleDateString('en-US', { day: '2-digit', month: 'short' }),
            price: b.c,
          }))
        )
      )
      .catch(() => {})
  }, [])

  const tickerItems = [
    { sym: 'SPX', price: '5,123.40', change: '+1.2%', up: true },
    { sym: 'NDX', price: '18,300.10', change: '+1.5%', up: true },
    { sym: 'EURUSD', price: '1.0940', change: '-0.2%', up: false },
    { sym: 'BTCUSD', price: '68,500', change: '+2.1%', up: true },
    { sym: 'ETHUSD', price: '3,890', change: '+3.4%', up: true },
    { sym: 'GOLD', price: '2,180.50', change: '+0.8%', up: true },
    { sym: 'OIL', price: '78.50', change: '-0.5%', up: false },
    { sym: 'BIST100', price: '9,150.20', change: '+0.9%', up: true },
    { sym: 'DAX', price: '17,832.10', change: '+0.6%', up: true },
    { sym: 'USDJPY', price: '151.20', change: '-0.3%', up: false },
    { sym: 'SILVER', price: '24.80', change: '+1.1%', up: true },
    { sym: 'FTSE', price: '7,742.00', change: '-0.1%', up: false },
  ]

  const stocks = [
    { name: 'Tesla', sym: 'TSLA', price: 175.34, chg: -1.2, color: 'bg-red-500/10 text-red-400' },
    { name: 'Apple', sym: 'AAPL', price: 172.50, chg: 0.5, color: 'bg-gray-500/10 text-gray-300' },
    { name: 'Nvidia', sym: 'NVDA', price: 890.10, chg: 2.3, color: 'bg-green-500/10 text-green-400' },
    { name: 'Amazon', sym: 'AMZN', price: 178.20, chg: 1.1, color: 'bg-yellow-500/10 text-yellow-400' },
    { name: 'Microsoft', sym: 'MSFT', price: 410.05, chg: 0.8, color: 'bg-blue-500/10 text-blue-400' },
  ]

  const cryptos = [
    { name: 'Bitcoin', sym: 'BTC', price: 68500, chg: 2.1, color: 'bg-orange-500/10 text-orange-400' },
    { name: 'Ethereum', sym: 'ETH', price: 3890, chg: 3.4, color: 'bg-blue-500/10 text-blue-400' },
    { name: 'Solana', sym: 'SOL', price: 145.20, chg: 5.6, color: 'bg-purple-500/10 text-purple-400' },
    { name: 'XRP', sym: 'XRP', price: 0.62, chg: -0.5, color: 'bg-sky-500/10 text-sky-400' },
    { name: 'Cardano', sym: 'ADA', price: 0.72, chg: 1.2, color: 'bg-teal-500/10 text-teal-400' },
  ]

  return (
    <section id="markets" className="relative bg-black py-10 overflow-hidden">

      {/* Ticker Tape */}
      <div className="w-full overflow-hidden border-y border-white/[0.05] bg-white/[0.02] py-3 mb-16">
        <div className="flex items-center gap-10 animate-marquee whitespace-nowrap px-8">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
            <div key={i} className="flex items-center gap-2.5">
              <span className="text-[11px] font-semibold tracking-widest text-[#787b86] uppercase">{item.sym}</span>
              <span className="text-sm font-medium text-white">{item.price}</span>
              <span className={`text-xs font-semibold flex items-center gap-0.5 ${item.up ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                {item.up ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2862ff]/10 border border-[#2862ff]/20 mb-6">
            <Activity size={12} className="text-[#2862ff]" />
            <span className="text-xs text-[#2862ff] font-semibold tracking-wider uppercase">Markets</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-4 tracking-tight">
            Markets at a Glance
          </h2>
          <p className="text-[#787b86] max-w-xl mx-auto text-lg">
            Prices across indices, equities, crypto, and commodities.
          </p>
        </div>

        {/* Market Data Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {/* Indices Card */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden hover:border-white/[0.1] transition-all duration-300 group">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-[#2862ff]/15 flex items-center justify-center">
                  <BarChart2 size={14} className="text-[#2862ff]" />
                </div>
                <span className="font-semibold text-white text-sm">Indices</span>
              </div>
              <Link href="/login" className="flex items-center gap-1 text-xs text-[#787b86] hover:text-[#2862ff] transition-colors">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {marketIndices.slice(0, 5).map((index) => (
                <Link
                  key={index.symbol}
                  href="/login"
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors group/row"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-md ${index.badgeColor} flex items-center justify-center text-[9px] text-white font-bold`}>
                      {index.badge}
                    </div>
                    <span className="text-sm text-[#d1d4dc] group-hover/row:text-white transition-colors font-medium">{index.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white font-medium">{index.price.toLocaleString()}</div>
                    <div className={`text-xs font-semibold ${index.changePercent >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                      {index.changePercent >= 0 ? '+' : ''}{index.changePercent}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Stocks Card */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden hover:border-white/[0.1] transition-all duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-purple-500/15 flex items-center justify-center">
                  <TrendingUp size={14} className="text-purple-400" />
                </div>
                <span className="font-semibold text-white text-sm">Stocks</span>
              </div>
              <Link href="/login" className="flex items-center gap-1 text-xs text-[#787b86] hover:text-[#2862ff] transition-colors">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {stocks.map((stock) => (
                <Link
                  key={stock.sym}
                  href="/login"
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors group/row"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-md ${stock.color} flex items-center justify-center text-[10px] font-bold`}>
                      {stock.sym[0]}
                    </div>
                    <div>
                      <div className="text-sm text-white font-medium group-hover/row:text-[#2862ff] transition-colors">{stock.sym}</div>
                      <div className="text-xs text-[#787b86]">{stock.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white font-medium">{stock.price}</div>
                    <div className={`text-xs font-semibold ${stock.chg >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                      {stock.chg >= 0 ? '+' : ''}{stock.chg}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Crypto Card */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden hover:border-white/[0.1] transition-all duration-300">
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/[0.05]">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-orange-500/15 flex items-center justify-center">
                  <Activity size={14} className="text-orange-400" />
                </div>
                <span className="font-semibold text-white text-sm">Crypto</span>
              </div>
              <Link href="/login" className="flex items-center gap-1 text-xs text-[#787b86] hover:text-[#2862ff] transition-colors">
                View all <ChevronRight size={12} />
              </Link>
            </div>
            <div className="divide-y divide-white/[0.03]">
              {cryptos.map((coin) => (
                <Link
                  key={coin.sym}
                  href="/login"
                  className="flex items-center justify-between px-5 py-3.5 hover:bg-white/[0.03] transition-colors group/row"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-7 h-7 rounded-md ${coin.color} flex items-center justify-center text-[10px] font-bold`}>
                      {coin.sym[0]}
                    </div>
                    <div>
                      <div className="text-sm text-white font-medium group-hover/row:text-[#2862ff] transition-colors">{coin.sym}USD</div>
                      <div className="text-xs text-[#787b86]">{coin.name}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white font-medium">{coin.price.toLocaleString()}</div>
                    <div className={`text-xs font-semibold ${coin.chg >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                      {coin.chg >= 0 ? '+' : ''}{coin.chg}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* BIST 100 Chart */}
        <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-6 py-5 border-b border-white/[0.05] gap-3">
            <div>
              <h3 className="text-lg font-bold text-white">BIST 100</h3>
              <p className="text-sm text-[#787b86]">Istanbul Stock Exchange — AI-powered analysis</p>
            </div>
            <div className="flex gap-2">
              {['1D', '1W', '1M', '3M'].map((tf, i) => (
                <button key={tf} className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${i === 1 ? 'bg-[#2862ff] text-white' : 'bg-white/[0.05] text-[#787b86] hover:bg-white/[0.08] hover:text-white'}`}>
                  {tf}
                </button>
              ))}
            </div>
          </div>
          <div className="p-6">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="marketGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#089981" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="#089981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="time"
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#4a4a4a', fontSize: 11 }}
                    interval="preserveStartEnd"
                    minTickGap={50}
                  />
                  <YAxis
                    domain={['dataMin - 50', 'dataMax + 50']}
                    axisLine={false}
                    tickLine={false}
                    tick={{ fill: '#4a4a4a', fontSize: 11 }}
                    tickFormatter={(v) => v.toLocaleString('en-US')}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0d0d0d',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: '10px',
                      color: '#d1d4dc',
                      fontSize: '12px',
                      boxShadow: '0 20px 40px rgba(0,0,0,0.5)',
                    }}
                    labelStyle={{ color: '#787b86' }}
                    formatter={(value) => [Number(value ?? 0).toLocaleString('en-US', { minimumFractionDigits: 2 }), 'Price']}
                  />
                  <Area
                    type="monotone"
                    dataKey="price"
                    stroke="#089981"
                    strokeWidth={2}
                    fill="url(#marketGradient)"
                    dot={false}
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

      </div>
    </section>
  )
}

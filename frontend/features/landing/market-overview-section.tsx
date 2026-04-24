'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { marketIndices } from '@/data/dashboard.mock'
import { fetchPrices } from '@/services/price.service'
import { TrendingUp, ChevronRight } from 'lucide-react'

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

  // Ticker Tape Data
  const tickerItems = [
    { sym: 'SPX', price: '5,123.40', change: '+1.2%', up: true },
    { sym: 'NDX', price: '18,300.10', change: '+1.5%', up: true },
    { sym: 'EURUSD', price: '1.0940', change: '-0.2%', up: false },
    { sym: 'BTCUSD', price: '68,500', change: '+2.1%', up: true },
    { sym: 'ETHUSD', price: '3,890', change: '+3.4%', up: true },
    { sym: 'GOLD', price: '2,180.50', change: '+0.8%', up: true },
    { sym: 'OIL', price: '78.50', change: '-0.5%', up: false },
    { sym: 'BIST100', price: '9,150.20', change: '+0.9%', up: true },
  ];

  return (
    <section id="markets" className="relative bg-[#131722] py-10">

      {/* Ticker Tape - Simulating the scrolling marquee */}
      <div className="w-full overflow-hidden border-y border-[#2a2e39] bg-[#1e222d] py-3 mb-10">
        <div className="flex items-center gap-8 animate-marquee whitespace-nowrap px-4">
          {[...tickerItems, ...tickerItems, ...tickerItems].map((item, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="font-bold text-white">{item.sym}</span>
              <span className="text-[#d1d4dc]">{item.price}</span>
              <span className={`text-xs font-medium ${item.up ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section Title */}
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Market Summary</h2>
          <p className="text-[#d1d4dc] max-w-2xl mx-auto text-lg">
            Snapshots of the most popular indices, stocks, and crypto assets.
          </p>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Card 1: Indices */}
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-xl overflow-hidden hover:border-[#787b86] transition-colors">
            <Link href="/login" className="p-4 border-b border-[#2a2e39] flex items-center justify-between hover:bg-[#2a2e39]/30 transition-colors">
              <h3 className="font-bold text-white flex items-center gap-2">
                <TrendingUp className="text-[#2962ff]" size={20} /> Indices
              </h3>
              <ChevronRight className="text-[#787b86]" size={16} />
            </Link>
            <div className="p-2">
              {marketIndices.slice(0, 5).map((index) => (
                <Link 
                  key={index.symbol} 
                  href="/login"
                  className="flex items-center justify-between p-3 hover:bg-[#2a2e39]/50 rounded cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full ${index.badgeColor} flex items-center justify-center text-[10px] text-white font-bold`}>
                      {index.badge}
                    </div>
                    <span className="text-white font-medium text-sm group-hover:text-[#2962ff] transition-colors">{index.name}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white">{index.price.toLocaleString()}</div>
                    <div className={`text-xs ${index.changePercent >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                      {index.changePercent >= 0 ? '+' : ''}{index.changePercent}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Card 2: Stocks */}
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-xl overflow-hidden hover:border-[#787b86] transition-colors">
            <Link href="/login" className="p-4 border-b border-[#2a2e39] flex items-center justify-between hover:bg-[#2a2e39]/30 transition-colors">
              <h3 className="font-bold text-white flex items-center gap-2">
                <TrendingUp className="text-[#2962ff]" size={20} /> Stocks
              </h3>
              <ChevronRight className="text-[#787b86]" size={16} />
            </Link>
            <div className="p-2">
              {[
                { name: 'Tesla', sym: 'TSLA', price: 175.34, chg: -1.2 },
                { name: 'Apple', sym: 'AAPL', price: 172.50, chg: 0.5 },
                { name: 'Nvidia', sym: 'NVDA', price: 890.10, chg: 2.3 },
                { name: 'Amazon', sym: 'AMZN', price: 178.20, chg: 1.1 },
                { name: 'Microsoft', sym: 'MSFT', price: 410.05, chg: 0.8 },
              ].map((stock) => (
                <Link 
                  key={stock.sym} 
                  href="/login"
                  className="flex items-center justify-between p-3 hover:bg-[#2a2e39]/50 rounded cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-500/20 text-blue-500 flex items-center justify-center text-[10px] font-bold">
                      {stock.sym[0]}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white font-medium text-sm group-hover:text-[#2962ff] transition-colors">{stock.sym}</span>
                      <span className="text-[#787b86] text-xs">{stock.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white">{stock.price}</div>
                    <div className={`text-xs ${stock.chg >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                      {stock.chg >= 0 ? '+' : ''}{stock.chg}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Card 3: Crypto */}
          <div className="bg-[#1e222d] border border-[#2a2e39] rounded-xl overflow-hidden hover:border-[#787b86] transition-colors">
            <Link href="/login" className="p-4 border-b border-[#2a2e39] flex items-center justify-between hover:bg-[#2a2e39]/30 transition-colors">
              <h3 className="font-bold text-white flex items-center gap-2">
                <TrendingUp className="text-[#2962ff]" size={20} /> Crypto
              </h3>
              <ChevronRight className="text-[#787b86]" size={16} />
            </Link>
            <div className="p-2">
              {[
                { name: 'Bitcoin', sym: 'BTC', price: 68500, chg: 2.1 },
                { name: 'Ethereum', sym: 'ETH', price: 3890, chg: 3.4 },
                { name: 'Solana', sym: 'SOL', price: 145.20, chg: 5.6 },
                { name: 'XRP', sym: 'XRP', price: 0.62, chg: -0.5 },
                { name: 'Cardano', sym: 'ADA', price: 0.72, chg: 1.2 },
              ].map((coin) => (
                <Link 
                  key={coin.sym} 
                  href="/login"
                  className="flex items-center justify-between p-3 hover:bg-[#2a2e39]/50 rounded cursor-pointer group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 text-orange-500 flex items-center justify-center text-[10px] font-bold">
                      {coin.sym[0]}
                    </div>
                    <div className="flex flex-col">
                      <span className="text-white font-medium text-sm group-hover:text-[#2962ff] transition-colors">{coin.sym}USD</span>
                      <span className="text-[#787b86] text-xs">{coin.name}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-white">{coin.price.toLocaleString()}</div>
                    <div className={`text-xs ${coin.chg >= 0 ? 'text-[#089981]' : 'text-[#f23645]'}`}>
                      {coin.chg >= 0 ? '+' : ''}{coin.chg}%
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

        </div>

        {/* Big Chart Section - Keeping it as a feature highlight */}
        <div className="mt-16 rounded-2xl bg-[#1e222d] border border-[#2a2e39] p-6 lg:p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-2xl font-bold text-white">BIST 100 Analytics</h3>
              <p className="text-[#787b86]">Real-time AI analysis of the Istanbul Stock Exchange</p>
            </div>
            <div className="flex gap-2">
              <span className="px-3 py-1 bg-[#2a2e39] rounded-md text-sm text-white font-medium hover:bg-[#363a45] cursor-pointer">1D</span>
              <span className="px-3 py-1 bg-[#2962ff] rounded-md text-sm text-white font-medium cursor-pointer">1W</span>
              <span className="px-3 py-1 bg-[#2a2e39] rounded-md text-sm text-white font-medium hover:bg-[#363a45] cursor-pointer">1M</span>
            </div>
          </div>
          <div className="h-[350px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="marketGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#089981" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#089981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#787b86', fontSize: 11 }}
                  interval="preserveStartEnd"
                  minTickGap={50}
                />
                <YAxis
                  domain={['dataMin - 50', 'dataMax + 50']}
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: '#787b86', fontSize: 11 }}
                  tickFormatter={(v) => v.toLocaleString('en-US')}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e222d',
                    border: '1px solid #2a2e39',
                    borderRadius: '8px',
                    color: '#d1d4dc',
                    fontSize: '12px',
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
    </section>
  )
}

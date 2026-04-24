'use client'

import { useEffect, useRef } from 'react'
import { createChart, CandlestickSeries, CrosshairMode, type IChartApi, type ISeriesApi } from 'lightweight-charts'
import type { PriceBar } from '@/types'

interface CandlestickChartProps {
  data: PriceBar[]
  className?: string
}

export function CandlestickChart({ data, className }: CandlestickChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<IChartApi | null>(null)
  const seriesRef = useRef<ISeriesApi<'Candlestick', import('lightweight-charts').Time> | null>(null)

  // Create chart once
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: '#000000' },
        textColor: '#787b86',
        fontFamily: 'inherit',
        fontSize: 11,
      },
      grid: {
        vertLines: { visible: false },
        horzLines: { color: '#1a1a1a' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: '#4b5563', labelBackgroundColor: '#1a1a1a' },
        horzLine: { color: '#4b5563', labelBackgroundColor: '#1a1a1a' },
      },
      rightPriceScale: {
        borderColor: '#2e2e2e',
        textColor: '#787b86',
        scaleMargins: { top: 0.08, bottom: 0.08 },
      },
      timeScale: {
        borderColor: '#2e2e2e',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: false,
        fixRightEdge: false,
      },
      handleScroll: true,
      handleScale: true,
    })

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: '#24a693',
      downColor: '#f23645',
      borderUpColor: '#24a693',
      borderDownColor: '#f23645',
      wickUpColor: '#24a693',
      wickDownColor: '#f23645',
    })

    chartRef.current = chart
    seriesRef.current = candleSeries

    // Resize observer
    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current = null
      seriesRef.current = null
    }
  }, [])

  // Update data when it changes
  useEffect(() => {
    if (!seriesRef.current || !data.length) return

    // Deduplicate by timestamp (keep last), sort ascending — required by lightweight-charts
    const seen = new Map<number, typeof data[0]>()
    for (const bar of data) {
      const ts = Math.floor(new Date(bar.t).getTime() / 1000)
      if (!isNaN(ts) && bar.o != null && bar.h != null && bar.l != null && bar.c != null) {
        seen.set(ts, bar)
      }
    }
    const candles = Array.from(seen.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([ts, bar]) => ({
        time: ts as unknown as import('lightweight-charts').Time,
        open: bar.o,
        high: bar.h,
        low: bar.l,
        close: bar.c,
      }))

    if (!candles.length) return
    seriesRef.current.setData(candles)
    chartRef.current?.timeScale().fitContent()
  }, [data])

  return <div ref={containerRef} className={className} style={{ width: '100%', height: '100%' }} />
}

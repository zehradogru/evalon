'use client'

import { Select } from '@/components/ui/select-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2, ScanLine } from 'lucide-react'
import { SCREENER_TIMEFRAMES } from '@/types/screener'
import type { ScreenerTimeframe } from '@/types/screener'
import { cn } from '@/lib/utils'
import { useTickerList } from '@/hooks/use-screener'

// Fallback list (Turkish names matching backend bist_sectors.json) used when the
// /tickers endpoint is unavailable. Keep in sync with backend sector data.
const FALLBACK_SECTORS = [
  'Altın', 'Banka', 'Cam', 'Çelik', 'Çimento', 'Dayanıklı Tüketim', 'Enerji',
  'Finans', 'Gıda & İçecek', 'GYO', 'Havacılık', 'Holding', 'İlaç', 'İnşaat',
  'Kağıt', 'Kimya', 'Lojistik', 'Madencilik', 'Medya', 'Orman Ürünleri',
  'Otomotiv', 'Perakende', 'Sağlık', 'Savunma', 'Sigorta', 'Spor', 'Teknoloji',
  'Tekstil', 'Telekomünikasyon', 'Turizm',
]

interface ScanControlsProps {
  timeframe: ScreenerTimeframe
  sectors: string[]
  lookbackBars: number
  isScanning: boolean
  onTimeframeChange: (tf: ScreenerTimeframe) => void
  onSectorsChange: (sectors: string[]) => void
  onLookbackChange: (bars: number) => void
  onScan: () => void
}

export function ScanControls({
  timeframe,
  sectors,
  lookbackBars,
  isScanning,
  onTimeframeChange,
  onSectorsChange,
  onLookbackChange,
  onScan,
}: ScanControlsProps) {
  function toggleSector(sector: string) {
    if (sectors.includes(sector)) {
      onSectorsChange(sectors.filter((s) => s !== sector))
    } else {
      onSectorsChange([...sectors, sector])
    }
  }

  const tickerListQuery = useTickerList()
  const sectorOptions =
    (tickerListQuery.data?.sectors && tickerListQuery.data.sectors.length > 0
      ? tickerListQuery.data.sectors
      : FALLBACK_SECTORS)

  return (
    <div className="flex flex-col gap-4">

      {/* Timeframe + Bars row */}
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Timeframe</span>
          <Select
            value={timeframe}
            onChange={(e) => onTimeframeChange(e.target.value as ScreenerTimeframe)}
            className="h-9 text-sm w-full"
          >
            {SCREENER_TIMEFRAMES.map((tf) => (
              <option key={tf.value} value={tf.value}>{tf.label}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Bars</span>
          <Input
            type="number"
            min={10}
            max={500}
            value={lookbackBars}
            onChange={(e) => onLookbackChange(parseInt(e.target.value) || 100)}
            className="h-9 text-sm w-full"
          />
        </div>
      </div>

      {/* Sector filter */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Sectors</span>
          {sectors.length > 0 && (
            <button
              type="button"
              onClick={() => onSectorsChange([])}
              className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Scrollable chip grid */}
        <div className="max-h-44 overflow-y-auto pr-0.5">
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => onSectorsChange([])}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                sectors.length === 0
                  ? 'border-primary bg-primary/15 text-primary'
                  : 'border-border text-muted-foreground hover:border-primary/60 hover:text-foreground'
              )}
            >
              All
            </button>
            {sectorOptions.map((sector) => (
              <button
                key={sector}
                type="button"
                onClick={() => toggleSector(sector)}
                className={cn(
                  'rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                  sectors.includes(sector)
                    ? 'border-primary bg-primary/15 text-primary'
                    : 'border-border text-muted-foreground hover:border-primary/60 hover:text-foreground'
                )}
              >
                {sector}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scan button */}
      <Button
        onClick={onScan}
        disabled={isScanning}
        className="w-full h-10 gap-2 text-sm font-semibold"
      >
        {isScanning ? (
          <Loader2 size={15} className="animate-spin" />
        ) : (
          <ScanLine size={15} />
        )}
        {isScanning ? 'Scanning...' : 'Scan BIST'}
      </Button>

    </div>
  )
}

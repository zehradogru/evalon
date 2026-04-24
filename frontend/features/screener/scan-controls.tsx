'use client'

import { Select } from '@/components/ui/select-native'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Loader2, ScanLine, X } from 'lucide-react'
import { SCREENER_TIMEFRAMES } from '@/types/screener'
import type { ScreenerTimeframe } from '@/types/screener'

const ALL_SECTORS = [
  'Banka', 'Enerji', 'Teknoloji', 'Çelik', 'Kimya', 'GYO', 'Holding', 'Havacılık',
  'Otomotiv', 'Perakende', 'Çimento', 'Gıda & İçecek', 'İlaç', 'Sigorta', 'Tekstil',
  'Madencilik', 'Lojistik', 'Savunma', 'Turizm', 'Telekomünikasyon', 'Cam', 'Sağlık',
  'Finans', 'Altın', 'Medya', 'Kağıt', 'Orman Ürünleri', 'Dayanıklı Tüketim', 'İnşaat',
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

  return (
    <div className="flex flex-col gap-3">
      {/* Row 1: timeframe + lookback + scan button */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Timeframe:</span>
          <Select
            value={timeframe}
            onChange={(e) => onTimeframeChange(e.target.value as ScreenerTimeframe)}
            className="h-8 text-xs w-20"
          >
            {SCREENER_TIMEFRAMES.map((tf) => (
              <option key={tf.value} value={tf.value}>{tf.label}</option>
            ))}
          </Select>
        </div>

        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground whitespace-nowrap">Bars:</span>
          <Input
            type="number"
            min={10}
            max={500}
            value={lookbackBars}
            onChange={(e) => onLookbackChange(parseInt(e.target.value) || 100)}
            className="h-8 text-xs w-16"
          />
        </div>

        <Button
          onClick={onScan}
          disabled={isScanning}
          size="sm"
          className="h-8 gap-1.5 min-w-[80px]"
        >
          {isScanning ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <ScanLine size={14} />
          )}
          {isScanning ? 'Scanning...' : 'Scan'}
        </Button>
      </div>

      {/* Row 2: sector chips */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-medium text-muted-foreground">Sector</span>
        <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          onClick={() => onSectorsChange([])}
          className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
            sectors.length === 0
              ? 'border-primary bg-primary/10 text-primary font-medium'
              : 'border-border text-muted-foreground hover:border-primary hover:text-foreground'
          }`}
        >
          All
        </button>
        {ALL_SECTORS.map((sector) => (
          <button
            key={sector}
            type="button"
            onClick={() => toggleSector(sector)}
            className={`rounded-full border px-2.5 py-0.5 text-xs transition-colors ${
              sectors.includes(sector)
                ? 'border-primary bg-primary/10 text-primary font-medium'
                : 'border-border text-muted-foreground hover:border-primary hover:text-foreground'
            }`}
          >
            {sector}
          </button>
        ))}        </div>      </div>
    </div>
  )
}

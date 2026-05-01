'use client'

import { useDeferredValue, useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useCoMovementSymbolSearch } from '@/hooks/use-co-movement'
import { cn } from '@/lib/utils'

interface CoMovementSymbolPickerProps {
    label: string
    selectedSymbols: string[]
    onChange: (symbols: string[]) => void
    maxSymbols?: number
    disabled?: boolean
    allowedSymbols?: string[]
    helperText?: string
}

export function CoMovementSymbolPicker({
    label,
    selectedSymbols,
    onChange,
    maxSymbols,
    disabled = false,
    allowedSymbols,
    helperText,
}: CoMovementSymbolPickerProps) {
    const [query, setQuery] = useState('')
    const deferredQuery = useDeferredValue(query.trim().toUpperCase())
    const searchQuery = useCoMovementSymbolSearch(deferredQuery, 10)

    const allowedSet = useMemo(
        () => (allowedSymbols ? new Set(allowedSymbols) : null),
        [allowedSymbols]
    )

    const suggestions = useMemo(() => {
        const items = searchQuery.data?.symbols ?? []
        return items.filter((item) => {
            if (selectedSymbols.includes(item.symbol)) return false
            if (allowedSet && !allowedSet.has(item.symbol)) return false
            return true
        })
    }, [allowedSet, searchQuery.data?.symbols, selectedSymbols])

    const hasReachedLimit =
        typeof maxSymbols === 'number' && selectedSymbols.length >= maxSymbols

    const addSymbol = (symbol: string) => {
        if (disabled || selectedSymbols.includes(symbol) || hasReachedLimit) {
            return
        }
        if (allowedSet && !allowedSet.has(symbol)) {
            return
        }

        onChange([...selectedSymbols, symbol])
        setQuery('')
    }

    const removeSymbol = (symbol: string) => {
        onChange(selectedSymbols.filter((item) => item !== symbol))
    }

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    {helperText ? (
                        <p className="text-xs text-muted-foreground">{helperText}</p>
                    ) : null}
                </div>
                <span className="text-xs text-muted-foreground">
                    {typeof maxSymbols === 'number'
                        ? `${selectedSymbols.length} / ${maxSymbols}`
                        : `${selectedSymbols.length} seçili`}
                </span>
            </div>

            <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                    value={query}
                    disabled={disabled}
                    onChange={(event) => setQuery(event.target.value)}
                    onKeyDown={(event) => {
                        if (event.key === 'Enter') {
                            event.preventDefault()
                            const candidate = query.trim().toUpperCase()
                            if (candidate) {
                                addSymbol(candidate)
                            }
                        }
                    }}
                    placeholder="Hisse ara... (AKBNK, THYAO)"
                    className="h-9 pl-8 text-sm"
                />

                {query.trim().length > 0 && !disabled ? (
                    <div className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-xl border border-border bg-card shadow-xl">
                        {searchQuery.isLoading ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                Hisseler aranıyor...
                            </div>
                        ) : hasReachedLimit ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                Seçim limiti doldu.
                            </div>
                        ) : suggestions.length === 0 ? (
                            <div className="px-3 py-2 text-xs text-muted-foreground">
                                Eşleşen hisse bulunamadı.
                            </div>
                        ) : (
                            suggestions.map((item) => (
                                <button
                                    key={item.symbol}
                                    type="button"
                                    onClick={() => addSymbol(item.symbol)}
                                    className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-muted/60"
                                >
                                    <span className="font-medium text-foreground">{item.symbol}</span>
                                    <span className="text-[11px] text-muted-foreground">Ekle</span>
                                </button>
                            ))
                        )}
                    </div>
                ) : null}
            </div>

            <div className="flex min-h-12 flex-wrap gap-2 rounded-xl border border-border/50 bg-background/40 p-3">
                {selectedSymbols.length === 0 ? (
                    <span className="text-sm text-muted-foreground">Henüz hisse seçilmedi.</span>
                ) : (
                    selectedSymbols.map((symbol) => (
                        <span
                            key={symbol}
                            className={cn(
                                'inline-flex items-center gap-1 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary',
                                disabled && 'opacity-70'
                            )}
                        >
                            {symbol}
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                disabled={disabled}
                                onClick={() => removeSymbol(symbol)}
                                className="h-5 w-5 rounded-full p-0 text-primary hover:bg-primary/20"
                            >
                                <X className="h-3 w-3" />
                            </Button>
                        </span>
                    ))
                )}
            </div>
        </div>
    )
}

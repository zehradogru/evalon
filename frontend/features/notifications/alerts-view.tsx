'use client'

import { useMemo, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Bell, Loader2, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import { cn } from '@/lib/utils'
import { BIST_AVAILABLE } from '@/config/markets'
import { useAddUserAlert, useRemoveUserAlert, useUserAlerts } from '@/hooks/use-user-alerts'
import type { UserAlertOperator } from '@/types'

export interface AlertsViewProps {
    isWidget?: boolean
}

export function AlertsView({ isWidget = false }: AlertsViewProps) {
    const { data: alerts = [], isLoading, isError, error } = useUserAlerts()
    const addAlertMutation = useAddUserAlert()
    const removeAlertMutation = useRemoveUserAlert()

    const [ticker, setTicker] = useState('')
    const [operator, setOperator] = useState<UserAlertOperator>('gt')
    const [targetPrice, setTargetPrice] = useState('')
    const [feedback, setFeedback] = useState<string | null>(null)

    const sortedAlerts = useMemo(
        () =>
            [...alerts].sort(
                (left, right) =>
                    new Date(right.createdAt).getTime() -
                    new Date(left.createdAt).getTime()
            ),
        [alerts]
    )

    const isBusy = addAlertMutation.isPending || removeAlertMutation.isPending

    const handleCreateAlert = async () => {
        setFeedback(null)

        const parsedTarget = Number(targetPrice)
        try {
            await addAlertMutation.mutateAsync({
                ticker,
                operator,
                targetPrice: parsedTarget,
            })
            setTicker('')
            setTargetPrice('')
        } catch (mutationError) {
            setFeedback(
                mutationError instanceof Error
                    ? mutationError.message
                    : 'Alert could not be created.'
            )
        }
    }

    const handleDeleteAlert = async (alertId: string) => {
        setFeedback(null)
        try {
            await removeAlertMutation.mutateAsync(alertId)
        } catch (mutationError) {
            setFeedback(
                mutationError instanceof Error
                    ? mutationError.message
                    : 'Alert could not be removed.'
            )
        }
    }

    return (
        <div className={cn('flex flex-col h-full bg-background', isWidget ? 'p-0' : 'p-6')}>
            {isWidget && (
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border sticky top-0 bg-background z-10">
                    <span className="font-semibold text-sm flex items-center gap-2">
                        <Bell size={16} /> Price Alerts
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                        {sortedAlerts.length} alerts
                    </span>
                </div>
            )}

            {!isWidget && (
                <div className="mb-4">
                    <h1 className="text-2xl font-bold">Price Alerts</h1>
                    <p className="text-sm text-muted-foreground">
                        Create and manage your personal price alerts.
                    </p>
                </div>
            )}

            <div className={cn('px-3 pt-3 pb-2 border-b border-border', !isWidget && 'rounded-md bg-card')}>
                <div
                    className={cn(
                        'grid gap-2',
                        isWidget ? 'grid-cols-[1fr_68px_92px_auto]' : 'grid-cols-1 md:grid-cols-[1fr_100px_140px_auto]'
                    )}
                >
                    <Input
                        list="bist-alert-tickers"
                        placeholder="Ticker (e.g. THYAO)"
                        value={ticker}
                        onChange={(event) => setTicker(event.target.value.toUpperCase())}
                        disabled={isBusy}
                    />
                    <datalist id="bist-alert-tickers">
                        {BIST_AVAILABLE.map((item) => (
                            <option key={item} value={item} />
                        ))}
                    </datalist>

                    <Select
                        value={operator}
                        onChange={(event) =>
                            setOperator(event.target.value as UserAlertOperator)
                        }
                        disabled={isBusy}
                    >
                        <option value="gt">{'>'}</option>
                        <option value="lt">{'<'}</option>
                    </Select>

                    <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Target"
                        value={targetPrice}
                        onChange={(event) => setTargetPrice(event.target.value)}
                        disabled={isBusy}
                    />

                    <Button
                        onClick={handleCreateAlert}
                        disabled={isBusy || !ticker.trim() || !targetPrice.trim()}
                    >
                        {addAlertMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Plus size={14} />
                        )}
                    </Button>
                </div>
                {feedback && (
                    <p className="mt-2 text-xs text-destructive">{feedback}</p>
                )}
            </div>

            <div className={cn('flex-1 overflow-auto', isWidget ? 'p-0' : 'mt-4 rounded-md border border-border bg-card')}>
                {isLoading ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                ) : isError ? (
                    <div className="p-4 text-sm text-destructive text-center">
                        {error instanceof Error ? error.message : 'Alerts could not be loaded.'}
                    </div>
                ) : (
                    <div className="flex flex-col divide-y divide-border">
                        {sortedAlerts.map((alert) => (
                            <div
                                key={alert.id}
                                className={cn(
                                    'flex items-center justify-between hover:bg-accent/50 transition-colors group',
                                    isWidget ? 'p-3' : 'p-4'
                                )}
                            >
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-sm">{alert.ticker}</span>
                                        <Badge
                                            variant="outline"
                                            className={cn(
                                                'text-[10px] px-1.5 py-0.5',
                                                alert.status === 'active'
                                                    ? 'border-primary/30 text-primary bg-primary/5'
                                                    : 'border-muted text-muted-foreground'
                                            )}
                                        >
                                            {alert.status}
                                        </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground truncate">
                                        Price {alert.operator === 'gt' ? '>' : '<'} {alert.targetPrice.toFixed(2)}
                                    </span>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-7 w-7 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                                    onClick={() => handleDeleteAlert(alert.id)}
                                    disabled={isBusy}
                                >
                                    <Trash2 size={14} />
                                </Button>
                            </div>
                        ))}
                        {sortedAlerts.length === 0 && (
                            <div className="p-8 text-center text-muted-foreground text-xs">
                                No alerts active.
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

'use client'

import { X, Clock, Ban } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { PaperOrder } from '@/types/paper-trade'

interface OrderBookWidgetProps {
    orders: PaperOrder[]
    onCancelOrder?: (orderId: string) => void
}

export function OrderBookWidget({ orders, onCancelOrder }: OrderBookWidgetProps) {
    const pendingOrders = orders.filter((o) => o.status === 'pending')

    return (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="p-4 border-b border-border flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">
                    Aktif Emirler ({pendingOrders.length})
                </h3>
            </div>

            {pendingOrders.length === 0 ? (
                <div className="p-6 text-center">
                    <p className="text-xs text-muted-foreground">Bekleyen emir yok.</p>
                </div>
            ) : (
                <div className="divide-y divide-border/30">
                    {pendingOrders.map((order) => {
                        const isBuy = order.side === 'buy'
                        return (
                            <div key={order.orderId} className="p-3 flex items-center justify-between group hover:bg-muted/10 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className={cn(
                                        'flex-shrink-0 w-1 h-8 rounded-full',
                                        isBuy ? 'bg-emerald-500' : 'bg-red-500'
                                    )} />
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-foreground">{order.ticker}</span>
                                            <span className={cn(
                                                'text-[10px] font-semibold',
                                                isBuy ? 'text-emerald-400' : 'text-red-400'
                                            )}>
                                                {isBuy ? 'BUY' : 'SELL'}
                                            </span>
                                            <span className="text-[10px] text-muted-foreground/60 uppercase">{order.type}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                                            <span>{order.quantity} adet</span>
                                            {order.limitPrice && <span>@ ₺{order.limitPrice.toFixed(2)}</span>}
                                            <span className="flex items-center gap-0.5">
                                                <Clock size={9} />
                                                {order.timeInForce}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={() => onCancelOrder?.(order.orderId)}
                                    className="p-1.5 rounded-md text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors opacity-0 group-hover:opacity-100"
                                    title="Cancel"
                                >
                                    <X size={14} />
                                </button>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}

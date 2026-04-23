'use client'

import { useState } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

interface ResetPortfolioDialogProps {
    open: boolean
    resetCount: number
    onConfirm: () => void
    onCancel: () => void
}

export function ResetPortfolioDialog({ open, resetCount, onConfirm, onCancel }: ResetPortfolioDialogProps) {
    if (!open) return null

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />

            {/* Dialog */}
            <div className="relative bg-card border border-border rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-5 animate-in fade-in zoom-in-95 duration-200">
                {/* Icon */}
                <div className="flex items-center justify-center">
                    <div className="h-14 w-14 rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertTriangle size={28} className="text-red-400" />
                    </div>
                </div>

                {/* Title */}
                <div className="text-center space-y-2">
                    <h3 className="text-lg font-bold text-foreground">Portföyü Sıfırla</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                        Tüm açık pozisyonlar kapatılacak, emir geçmişi silinecek ve bakiyeniz{' '}
                        <span className="text-foreground font-semibold">₺100.000</span>'e
                        sıfırlanacak.
                    </p>
                    <p className="text-xs text-muted-foreground/60">
                        Bu işlem geri alınamaz. • {resetCount}. reset
                    </p>
                </div>

                {/* Actions */}
                <div className="grid grid-cols-2 gap-3">
                    <button
                        onClick={onCancel}
                        className="py-2.5 rounded-xl text-sm font-medium text-foreground bg-secondary/50 hover:bg-secondary/80 transition-colors"
                    >
                        İptal
                    </button>
                    <button
                        onClick={onConfirm}
                        className="py-2.5 rounded-xl text-sm font-medium text-white bg-red-500 hover:bg-red-600 transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                    >
                        <RefreshCw size={14} />
                        Sıfırla
                    </button>
                </div>
            </div>
        </div>
    )
}

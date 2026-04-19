'use client'

import { X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast, useToastItems } from '@/hooks/use-toast'

export function Toaster() {
    const toasts = useToastItems()
    const { dismiss } = useToast()

    return (
        <div className="pointer-events-none fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2">
            {toasts.map((toast) => (
                <div
                    key={toast.id}
                    className={cn(
                        'pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur',
                        toast.variant === 'destructive'
                            ? 'border-destructive/40 bg-destructive/10 text-white'
                            : 'border-border bg-card text-card-foreground'
                    )}
                >
                    <div className="flex items-start gap-3">
                        <div className="min-w-0 flex-1">
                            {toast.title ? (
                                <p className="text-sm font-semibold">{toast.title}</p>
                            ) : null}
                            <p className="text-sm text-muted-foreground">
                                {toast.description}
                            </p>
                        </div>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => dismiss(toast.id)}
                        >
                            <X />
                        </Button>
                    </div>
                </div>
            ))}
        </div>
    )
}

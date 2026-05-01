'use client'

import { useEffect } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast, useToastItems, type ToastItem } from '@/hooks/use-toast'

function getToastMeta(variant: ToastItem['variant']) {
  switch (variant) {
    case 'success':
      return {
        Icon: CheckCircle2,
        iconClassName: 'text-chart-2',
        className: 'border-chart-2/40 bg-chart-2/10',
      }
    case 'destructive':
      return {
        Icon: XCircle,
        iconClassName: 'text-destructive',
        className: 'border-destructive/40 bg-destructive/10',
      }
    case 'warning':
      return {
        Icon: AlertTriangle,
        iconClassName: 'text-chart-4',
        className: 'border-chart-4/40 bg-chart-4/10',
      }
    case 'info':
    case 'default':
    default:
      return {
        Icon: Info,
        iconClassName: 'text-primary',
        className: 'border-primary/30 bg-card',
      }
  }
}

export function Toaster() {
  const toasts = useToastItems()
  const { dismiss, dismissLatest } = useToast()

  useEffect(() => {
    if (toasts.length === 0) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        dismissLatest()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [dismissLatest, toasts.length])

  return (
    <div className="pointer-events-none fixed inset-x-4 top-4 z-[100] flex max-w-none flex-col gap-2 sm:right-4 sm:left-auto sm:max-w-sm">
      {toasts.map((toast) => {
        const meta = getToastMeta(toast.variant)
        const Icon = meta.Icon
        const isAssertive = toast.variant === 'destructive'

        return (
          <div
            key={toast.id}
            role="alert"
            aria-live={isAssertive ? 'assertive' : 'polite'}
            aria-atomic="true"
            data-state={toast.status === 'closing' ? 'closed' : 'open'}
            className={cn(
              'text-card-foreground pointer-events-auto grid max-h-40 overflow-hidden rounded-lg border px-4 py-3 shadow-lg backdrop-blur transition-all ease-out',
              'data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-right-4 data-[state=open]:duration-300',
              'data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:max-h-0 data-[state=closed]:px-4 data-[state=closed]:py-0 data-[state=closed]:duration-200',
              meta.className
            )}
          >
            <div className="flex items-start gap-3">
              <Icon
                className={cn(
                  'mt-0.5 h-5 w-5 flex-shrink-0',
                  meta.iconClassName,
                  toast.variant === 'success' &&
                    'animate-in zoom-in duration-300'
                )}
                aria-hidden="true"
              />
              <div className="min-w-0 flex-1">
                {toast.title ? (
                  <p className="text-sm leading-5 font-semibold">
                    {toast.title}
                  </p>
                ) : null}
                <p className="text-muted-foreground text-sm leading-5">
                  {toast.description}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-primary h-11 w-11 flex-shrink-0 rounded-lg sm:h-8 sm:w-8"
                onClick={() => dismiss(toast.id)}
                aria-label="Dismiss notification"
                title="Dismiss notification"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

'use client'

import { create } from 'zustand'

export type ToastVariant =
  | 'default'
  | 'success'
  | 'destructive'
  | 'warning'
  | 'info'
export type ToastStatus = 'open' | 'closing'

export interface ToastItem {
  id: string
  title?: string
  description: string
  variant?: ToastVariant
  status?: ToastStatus
  duration?: number
}

interface ToastState {
  toasts: ToastItem[]
  showToast: (toast: Omit<ToastItem, 'id' | 'status'>) => string
  dismissToast: (id: string) => void
  dismissLatestToast: () => void
}

const DEFAULT_TOAST_DURATION = 3000
const TOAST_EXIT_DURATION = 200
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()
const toastRemovalTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function clearToastTimeout(id: string) {
  const timeoutId = toastTimeouts.get(id)
  if (!timeoutId) return
  clearTimeout(timeoutId)
  toastTimeouts.delete(id)
}

function clearToastRemovalTimeout(id: string) {
  const timeoutId = toastRemovalTimeouts.get(id)
  if (!timeoutId) return
  clearTimeout(timeoutId)
  toastRemovalTimeouts.delete(id)
}

const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  showToast: (toast) => {
    const id =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    const duration = toast.duration ?? DEFAULT_TOAST_DURATION

    clearToastRemovalTimeout(id)
    set((state) => ({
      toasts: [...state.toasts, { ...toast, id, duration, status: 'open' }],
    }))

    const timeoutId = setTimeout(() => {
      get().dismissToast(id)
    }, duration)

    toastTimeouts.set(id, timeoutId)

    return id
  },
  dismissToast: (id) => {
    clearToastTimeout(id)
    clearToastRemovalTimeout(id)

    const existingToast = get().toasts.find((toast) => toast.id === id)
    if (!existingToast || existingToast.status === 'closing') {
      return
    }

    set((state) => ({
      toasts: state.toasts.map((toast) =>
        toast.id === id ? { ...toast, status: 'closing' } : toast
      ),
    }))

    const removalTimeoutId = setTimeout(() => {
      toastRemovalTimeouts.delete(id)
      set((state) => ({
        toasts: state.toasts.filter((toast) => toast.id !== id),
      }))
    }, TOAST_EXIT_DURATION)

    toastRemovalTimeouts.set(id, removalTimeoutId)
  },
  dismissLatestToast: () => {
    const latestToast = get().toasts.at(-1)
    if (latestToast) {
      get().dismissToast(latestToast.id)
    }
  },
}))

export function useToast() {
  const showToast = useToastStore((state) => state.showToast)
  const dismissToast = useToastStore((state) => state.dismissToast)
  const dismissLatestToast = useToastStore((state) => state.dismissLatestToast)

  return {
    toast: showToast,
    dismiss: dismissToast,
    dismissLatest: dismissLatestToast,
  }
}

export function useToastItems() {
  return useToastStore((state) => state.toasts)
}

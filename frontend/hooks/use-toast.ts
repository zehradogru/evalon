'use client'

import { create } from 'zustand'

export type ToastVariant = 'default' | 'destructive'

export interface ToastItem {
    id: string
    title?: string
    description: string
    variant?: ToastVariant
    duration?: number
}

interface ToastState {
    toasts: ToastItem[]
    showToast: (toast: Omit<ToastItem, 'id'>) => string
    dismissToast: (id: string) => void
}

const DEFAULT_TOAST_DURATION = 3000
const toastTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function clearToastTimeout(id: string) {
    const timeoutId = toastTimeouts.get(id)
    if (!timeoutId) return
    clearTimeout(timeoutId)
    toastTimeouts.delete(id)
}

const useToastStore = create<ToastState>((set, get) => ({
    toasts: [],
    showToast: (toast) => {
        const id =
            typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
        const duration = toast.duration ?? DEFAULT_TOAST_DURATION

        set((state) => ({
            toasts: [...state.toasts, { ...toast, id, duration }],
        }))

        const timeoutId = setTimeout(() => {
            get().dismissToast(id)
        }, duration)

        toastTimeouts.set(id, timeoutId)

        return id
    },
    dismissToast: (id) => {
        clearToastTimeout(id)
        set((state) => ({
            toasts: state.toasts.filter((toast) => toast.id !== id),
        }))
    },
}))

export function useToast() {
    const showToast = useToastStore((state) => state.showToast)
    const dismissToast = useToastStore((state) => state.dismissToast)

    return {
        toast: showToast,
        dismiss: dismissToast,
    }
}

export function useToastItems() {
    return useToastStore((state) => state.toasts)
}

import { DEFAULT_EVALON_API_URL } from '@/lib/evalon'

// API base URL - legacy internal services
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Evalon API URL
export const EVALON_API_URL =
    process.env.NEXT_PUBLIC_EVALON_API_URL || DEFAULT_EVALON_API_URL

// WebSocket URL - reserved for future realtime features
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'

// Legacy mock toggle for parts of the app that still depend on internal placeholder APIs.
export const USE_MOCK_DATA = true

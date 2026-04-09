// API base URL - şu an için mock data kullanıyoruz
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

// Evalon Price API URL
export const EVALON_API_URL = process.env.NEXT_PUBLIC_EVALON_API_URL || 'https://evalon-mu.vercel.app'

// WebSocket URL - gerçek backend hazır olunca kullanılacak
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001'

// Mock data kullanımı (backend hazır olunca false yapılacak)
export const USE_MOCK_DATA = true

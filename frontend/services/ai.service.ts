import type {
    AiAsset,
    AiAssetsResponse,
    AiMessageResponse,
    AiRequestContext,
    AiSession,
    AiSessionCreateResponse,
    AiToolCatalog,
} from '@/types'

async function parseError(response: Response): Promise<never> {
    const payload = await response.json().catch(() => ({}))
    throw new Error(String(payload.detail || payload.error || 'AI request failed.'))
}

export const aiService = {
    async getTools(): Promise<AiToolCatalog> {
        const response = await fetch('/api/ai/tools')
        if (!response.ok) return parseError(response)
        return response.json()
    },

    async createSession(userId: string, title?: string): Promise<AiSessionCreateResponse> {
        const response = await fetch('/api/ai/sessions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId, title }),
        })
        if (!response.ok) return parseError(response)
        return response.json()
    },

    async getSession(sessionId: string): Promise<AiSession> {
        const response = await fetch(`/api/ai/sessions/${sessionId}`, {
            cache: 'no-store',
        })
        if (!response.ok) return parseError(response)
        return response.json()
    },

    async sendMessage(
        sessionId: string,
        content: string,
        context: AiRequestContext
    ): Promise<AiMessageResponse> {
        const response = await fetch(`/api/ai/sessions/${sessionId}/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                content,
                context,
            }),
        })
        if (!response.ok) return parseError(response)
        return response.json()
    },

    async getAssets(userId: string): Promise<AiAssetsResponse> {
        const response = await fetch(`/api/ai/assets?userId=${encodeURIComponent(userId)}`, {
            cache: 'no-store',
        })
        if (!response.ok) return parseError(response)
        return response.json()
    },

    async saveAsset(
        kind: 'strategies' | 'rules' | 'indicators',
        asset: {
            userId: string
            title: string
            description: string
            prompt?: string | null
            spec: Record<string, unknown>
        }
    ): Promise<AiAsset> {
        const response = await fetch(`/api/ai/${kind}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(asset),
        })
        if (!response.ok) return parseError(response)
        return response.json()
    },
}

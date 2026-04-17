import type {
    BacktestBlueprint,
    BacktestEventsResponse,
    BacktestPresetCatalogResponse,
    BacktestRuleCatalogResponse,
    BacktestRunResponse,
    BacktestStatusResponse,
    PortfolioCurveResponse,
} from '@/types'

async function parseError(response: Response): Promise<never> {
    const payload = await response.json().catch(() => ({}))
    throw new Error(String(payload.detail || payload.error || 'Backtest request failed.'))
}

export const backtestsService = {
    async getRuleCatalog(): Promise<BacktestRuleCatalogResponse> {
        const response = await fetch('/api/backtests/catalog/rules')
        if (!response.ok) return parseError(response)
        return response.json()
    },

    async getPresetCatalog(): Promise<BacktestPresetCatalogResponse> {
        const response = await fetch('/api/backtests/catalog/presets')
        if (!response.ok) return parseError(response)
        return response.json()
    },

    async runSync(body: BacktestBlueprint): Promise<BacktestRunResponse> {
        const response = await fetch('/api/backtests/run', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })
        if (!response.ok) return parseError(response)
        return response.json()
    },

    async startAsync(body: BacktestBlueprint): Promise<BacktestStatusResponse> {
        const response = await fetch('/api/backtests/start', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        })
        if (!response.ok) return parseError(response)
        return response.json()
    },

    async getStatus(runId: string): Promise<BacktestStatusResponse> {
        const response = await fetch(`/api/backtests/${runId}/status`, {
            cache: 'no-store',
        })
        if (!response.ok) return parseError(response)
        return response.json()
    },

    async getEvents(
        runId: string,
        page = 1,
        limit = 200
    ): Promise<BacktestEventsResponse> {
        const response = await fetch(
            `/api/backtests/${runId}/events?page=${page}&limit=${limit}`,
            {
                cache: 'no-store',
            }
        )
        if (!response.ok) return parseError(response)
        return response.json()
    },

    async getPortfolioCurve(runId: string): Promise<PortfolioCurveResponse> {
        const response = await fetch(`/api/backtests/${runId}/portfolio-curve`, {
            cache: 'no-store',
        })
        if (!response.ok) return parseError(response)
        return response.json()
    },
}

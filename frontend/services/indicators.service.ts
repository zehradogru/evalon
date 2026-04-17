import type {
    IndicatorCatalogResponse,
    IndicatorQueryParams,
    IndicatorResponse,
} from '@/types'

function buildIndicatorQuery(params: IndicatorQueryParams): URLSearchParams {
    const search = new URLSearchParams({
        ticker: params.ticker,
        timeframe: params.timeframe,
        strategy: params.strategy,
    })

    if (params.period !== undefined) search.set('period', String(params.period))
    if (params.fast !== undefined) search.set('fast', String(params.fast))
    if (params.slow !== undefined) search.set('slow', String(params.slow))
    if (params.signal !== undefined) search.set('signal', String(params.signal))
    if (params.limit !== undefined) search.set('limit', String(params.limit))
    if (params.start) search.set('start', params.start)
    if (params.end) search.set('end', params.end)

    return search
}

export const indicatorsService = {
    async getCatalog(): Promise<IndicatorCatalogResponse> {
        const response = await fetch('/api/indicators/catalog')
        if (!response.ok) {
            throw new Error('Indicator catalog could not be loaded.')
        }
        return response.json()
    },

    async getIndicators(params: IndicatorQueryParams): Promise<IndicatorResponse> {
        const response = await fetch(`/api/indicators?${buildIndicatorQuery(params)}`)
        if (!response.ok) {
            const error = await response.json().catch(() => ({}))
            throw new Error(
                String(error.detail || error.error || 'Indicator request failed.')
            )
        }

        const payload = (await response.json()) as Partial<IndicatorResponse>

        return {
            ticker: payload.ticker || params.ticker,
            timeframe: payload.timeframe || params.timeframe,
            strategy: payload.strategy || params.strategy,
            indicators: Array.isArray(payload.indicators)
                ? payload.indicators.map((series) => ({
                      ...series,
                      series: Array.isArray(series?.series) ? series.series : [],
                  }))
                : [],
        }
    },
}

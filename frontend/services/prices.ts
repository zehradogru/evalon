import { FetchPricesParams, PricesResponse, PriceBar } from '@/types/market';

const BASE_URL = '/api/prices';

export const pricesService = {
    /**
     * Fetch historical price data for a ticker
     */
    async getPrices(params: FetchPricesParams): Promise<PricesResponse> {
        const query = new URLSearchParams({
            ticker: params.ticker,
            timeframe: params.timeframe,
        });

        if (params.limit) {
            query.append('limit', params.limit.toString());
        }
        if (params.start) {
            query.append('start', params.start);
        }
        if (params.end) {
            query.append('end', params.end);
        }

        const url = `${BASE_URL}?${query.toString()}`;

        const response = await fetch(url, {
            // Can add next.js revalidation here or use React Query in the component
            next: { revalidate: 60 } // Cache for 60 seconds
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch prices: ${response.status} ${response.statusText}`);
        }

        const data: PricesResponse = await response.json();

        // Ensure data is sorted by time ascending for charts
        if (data.data && Array.isArray(data.data)) {
            data.data.sort((a, b) => new Date(a.t).getTime() - new Date(b.t).getTime());
        }

        return data;
    },

    /**
     * Get the latest single price bar for multiple tickers
     * Useful for the markets overview table.
     * Note: Since there isn't a batch endpoint provided, we might have to fetch individually.
     * We'll fetch 1 day timeframe with limit=1.
     */
    async getLatestPrice(ticker: string): Promise<PriceBar | null> {
        try {
            // Fetch the last 2 bars (today and yesterday) to calculate change
            const res = await this.getPrices({
                ticker,
                timeframe: '1d',
                limit: 2
            });

            if (res.data && res.data.length > 0) {
                // Return the most recent bar. We might also want the previous to calculate change.
                return res.data[res.data.length - 1];
            }
            return null;
        } catch (e) {
            console.error(`Failed to get latest price for ${ticker}`, e);
            return null;
        }
    },

    /**
     * Get the latest price and the previous day's price to calculate change
     */
    async getLatestPriceWithChange(ticker: string): Promise<{ current: PriceBar, previous: PriceBar | null } | null> {
        try {
            // Fetch 10 bars from 14 days ago to ensure we get the most recent data
            const now = new Date();
            const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
            
            const res = await this.getPrices({
                ticker,
                timeframe: '1d',
                limit: 10,
                start: twoWeeksAgo.toISOString().split('T')[0]
            });

            if (res.data && res.data.length > 0) {
                // Sort by time to ensure correct order, then take last 2
                const sorted = [...res.data].sort((a, b) => 
                    new Date(a.t).getTime() - new Date(b.t).getTime()
                );
                const current = sorted[sorted.length - 1];
                const previous = sorted.length > 1 ? sorted[sorted.length - 2] : null;
                return { current, previous };
            }
            return null;
        } catch (e) {
            console.error(`Failed to get price with change for ${ticker}`, e);
            return null;
        }
    }
};

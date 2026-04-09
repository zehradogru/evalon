import type {
    SignalModel,
    SignalRunResponse,
    StrategyCatalogResponse,
    StrategyDefinition,
    TimeFrame,
} from '@graph/shared-types';

const API_BASE = import.meta.env.VITE_API_BASE || '/api/v1';

interface RunSignalsRequest {
    symbol: string;
    tf: TimeFrame;
    range: { from: number; to: number };
    strategies: Array<{ id: string; params: Record<string, unknown> }>;
    combine?: 'and' | 'or';
}

export class StrategyService {
    private static instance: StrategyService;

    private constructor() {}

    static getInstance(): StrategyService {
        if (!StrategyService.instance) {
            StrategyService.instance = new StrategyService();
        }
        return StrategyService.instance;
    }

    async fetchCatalog(): Promise<StrategyDefinition[]> {
        try {
            const res = await fetch(`${API_BASE}/strategies/catalog`);
            if (!res.ok) {
                const detail = await res.text();
                console.error('Strategy catalog fetch failed:', res.status, detail);
                return [];
            }
            const payload = await res.json() as StrategyCatalogResponse;
            return payload.strategies || [];
        } catch (err) {
            console.error('StrategyService.fetchCatalog error:', err);
            return [];
        }
    }

    async runSignals(req: RunSignalsRequest): Promise<SignalModel[]> {
        try {
            if (req.strategies.length === 0) return [];

            const body = {
                symbol: req.symbol,
                tf: req.tf,
                range: req.range,
                strategyId: req.strategies[0].id,
                params: req.strategies[0].params || {},
                strategyIds: req.strategies.map((s) => s.id),
                strategies: req.strategies,
                combine: req.combine || 'and',
            };

            const res = await fetch(`${API_BASE}/signals/run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            if (!res.ok) {
                const detail = await res.text();
                throw new Error(`Strategy signal run failed: HTTP ${res.status} ${detail.slice(0, 200)}`);
            }

            const payload = await res.json() as SignalRunResponse;
            return payload.signals || [];
        } catch (err) {
            console.error('StrategyService.runSignals error:', err);
            throw err;
        }
    }
}

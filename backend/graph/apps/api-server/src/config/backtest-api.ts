const DEFAULT_BACKTEST_API_BASE = 'https://evalon-backtest-api-474112640179.europe-west1.run.app/v1';

export function getBacktestApiBase(): string {
    return (process.env.BACKTEST_API_BASE || DEFAULT_BACKTEST_API_BASE).replace(/\/$/, '');
}

export function getBacktestApiDisplayBase(): string {
    return process.env.BACKTEST_API_BASE || DEFAULT_BACKTEST_API_BASE;
}

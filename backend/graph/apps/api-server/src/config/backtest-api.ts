const DEFAULT_BACKTEST_API_BASE = 'https://evalon-backtest-api-r2ffcuqmuq-ew.a.run.app/v1';

export function getBacktestApiBase(): string {
    return (process.env.BACKTEST_API_BASE || DEFAULT_BACKTEST_API_BASE).replace(/\/$/, '');
}

export function getBacktestApiDisplayBase(): string {
    return process.env.BACKTEST_API_BASE || DEFAULT_BACKTEST_API_BASE;
}

'use client';

import { mockBacktestResults } from '@/data/mocks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, Activity, BarChart2 } from 'lucide-react';

export function BacktestView() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Backtest Results</h1>
                <p className="text-muted-foreground">Historical performance analysis of your strategies.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {mockBacktestResults.map((result) => (
                    <Card key={result.id} className="p-6 bg-card border-border">
                        <div className="flex justify-between items-start mb-6">
                            <div>
                                <h3 className="text-2xl font-bold">{result.strategyName}</h3>
                                <div className="flex items-center gap-2 mt-2">
                                    <Badge variant="outline" className="border-border">
                                        {result.trades} Trades
                                    </Badge>
                                    <Badge variant="secondary" className="bg-secondary text-secondary-foreground">
                                        Win Rate: {result.winRate}%
                                    </Badge>
                                </div>
                            </div>
                            <div className={`text-xl font-bold ${result.totalReturn >= 0 ? 'text-chart-2' : 'text-destructive'}`}>
                                {result.totalReturn >= 0 ? '+' : ''}{result.totalReturn}%
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-accent/5 p-4 rounded-lg">
                                <div className="text-sm text-muted-foreground mb-1">Total Return</div>
                                <div className={`text-lg font-bold flex items-center gap-2 ${result.totalReturn >= 0 ? 'text-chart-2' : 'text-destructive'}`}>
                                    {result.totalReturn >= 0 ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                                    {result.totalReturn}%
                                </div>
                            </div>
                            <div className="bg-accent/5 p-4 rounded-lg">
                                <div className="text-sm text-muted-foreground mb-1">Max Drawdown</div>
                                <div className="text-lg font-bold text-destructive">
                                    {result.maxDrawdown}%
                                </div>
                            </div>
                            <div className="bg-accent/5 p-4 rounded-lg">
                                <div className="text-sm text-muted-foreground mb-1">Profit Factor</div>
                                <div className="text-lg font-bold text-foreground">
                                    {(result.winRate / (100 - result.winRate) * 1.5).toFixed(2)} {/* Mock Calc */}
                                </div>
                            </div>
                        </div>

                        <div className="h-32 bg-accent/5 rounded-lg flex items-end p-2 gap-1 relative overflow-hidden">
                            <div className="absolute top-2 left-2 text-xs text-muted-foreground">Equity Curve Preview</div>
                            {result.equityCurve.map((val, i) => (
                                <div
                                    key={i}
                                    className={`flex-1 rounded-sm ${val >= 100 ? 'bg-chart-2/50' : 'bg-destructive/50'}`}
                                    style={{ height: `${((val - 80) / 80) * 100}%` }}
                                />
                            ))}
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

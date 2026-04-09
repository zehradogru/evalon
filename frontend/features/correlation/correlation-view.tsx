'use client';

import { mockCorrelations } from '@/data/mocks';
import { Card } from '@/components/ui/card';

export function CorrelationView() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Correlation Matrix</h1>
                <p className="text-muted-foreground">Analyze the relationship between different assets.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="p-6 bg-card border-border col-span-1 md:col-span-2">
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left">
                                    <th className="p-4 font-medium text-muted-foreground">Asset Pair</th>
                                    <th className="p-4 font-medium text-muted-foreground text-right">Correlation</th>
                                    <th className="p-4 font-medium text-muted-foreground">Strength</th>
                                    <th className="p-4 font-medium text-muted-foreground">Visualization</th>
                                </tr>
                            </thead>
                            <tbody>
                                {mockCorrelations.map((corr, i) => (
                                    <tr key={i} className="border-b border-border hover:bg-accent/5">
                                        <td className="p-4 font-semibold">
                                            <span className="text-foreground">{corr.ticker1}</span>
                                            <span className="text-muted-foreground mx-2">vs</span>
                                            <span className="text-foreground">{corr.ticker2}</span>
                                        </td>
                                        <td className={`p-4 text-right font-bold ${Math.abs(corr.value) > 0.7 ? 'text-chart-1' : 'text-muted-foreground'
                                            }`}>
                                            {corr.value}
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-2 py-1 rounded text-xs ${Math.abs(corr.value) > 0.8 ? 'bg-primary/10 text-primary' :
                                                    Math.abs(corr.value) > 0.5 ? 'bg-chart-4/10 text-chart-4' : 'bg-secondary text-muted-foreground'
                                                }`}>
                                                {Math.abs(corr.value) > 0.8 ? 'Strong' : Math.abs(corr.value) > 0.5 ? 'Moderate' : 'Weak'}
                                                {corr.value > 0 ? ' Positive' : ' Negative'}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            <div className="h-2 w-32 bg-secondary rounded-full overflow-hidden relative">
                                                <div
                                                    className={`absolute h-full rounded-full ${corr.value > 0 ? 'bg-chart-2' : 'bg-destructive'}`}
                                                    style={{
                                                        width: `${Math.abs(corr.value) * 50}%`,
                                                        left: corr.value > 0 ? '50%' : `${50 - Math.abs(corr.value) * 50}%`
                                                    }}
                                                />
                                                <div className="absolute left-1/2 top-0 bottom-0 w-[1px] bg-foreground/50" />
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Card>
            </div>
        </div>
    );
}

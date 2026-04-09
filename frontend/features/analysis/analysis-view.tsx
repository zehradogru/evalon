'use client';

import { mockAnalysisSignals } from '@/data/mocks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowUpRight, ArrowDownRight, Minus, Zap } from 'lucide-react';

export function AnalysisView() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Technical Analysis</h1>
                <p className="text-muted-foreground">AI-powered market signals and technical breakdown.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockAnalysisSignals.map((signal) => (
                    <Card key={signal.id} className="p-6 border-border bg-card hover:bg-accent/5 transition-colors group">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h3 className="text-xl font-bold">{signal.ticker}</h3>
                                <span className="text-xs text-muted-foreground">{new Date(signal.timestamp).toLocaleTimeString()}</span>
                            </div>
                            <Badge
                                variant={
                                    signal.type === 'BUY' ? 'default' :
                                        signal.type === 'SELL' ? 'destructive' : 'secondary'
                                }
                                className={
                                    signal.type === 'BUY' ? 'bg-chart-2 hover:bg-chart-2/90' :
                                        signal.type === 'SELL' ? 'bg-destructive hover:bg-destructive/90' : ''
                                }
                            >
                                {signal.type}
                            </Badge>
                        </div>

                        <div className="flex items-center gap-2 mb-4">
                            <Zap size={16} className="text-chart-4" />
                            <span className="text-sm font-medium">Confidence: {signal.confidence}%</span>
                            <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-chart-4 rounded-full"
                                    style={{ width: `${signal.confidence}%` }}
                                />
                            </div>
                        </div>

                        <p className="text-sm text-muted-foreground mb-4">
                            {signal.reason}
                        </p>

                        <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                            VIEW DETAILS
                            <ArrowUpRight size={14} className="ml-auto" />
                        </div>
                    </Card>
                ))}

                {/* Placeholder cards to fill space */}
                {[1, 2, 3].map((i) => (
                    <Card key={`placeholder-${i}`} className="p-6 border-dashed border-border bg-transparent flex items-center justify-center min-h-[200px] opacity-50">
                        <span className="text-muted-foreground text-sm">Waiting for new signals...</span>
                    </Card>
                ))}
            </div>
        </div>
    );
}

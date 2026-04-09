'use client';

import { mockStrategies } from '@/data/mocks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Plus, Play, Edit3, Settings } from 'lucide-react';

export function StrategyView() {
    return (
        <div className="flex flex-col gap-6 p-6">
            <div className="flex justify-between items-center">
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Strategy Builder</h1>
                    <p className="text-muted-foreground">Create, manage, and deploy your trading algorithms.</p>
                </div>
                <Button className="bg-primary hover:bg-primary/90 text-white gap-2">
                    <Plus size={16} /> New Strategy
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {mockStrategies.map((strategy) => (
                    <Card key={strategy.id} className="group p-6 bg-card border-border hover:border-primary/50 transition-colors flex flex-col h-full">
                        <div className="flex justify-between items-start mb-4">
                            <Badge variant="outline" className="border-border text-muted-foreground">
                                {strategy.author}
                            </Badge>
                            <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <Settings size={14} />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                                    <Edit3 size={14} />
                                </Button>
                            </div>
                        </div>

                        <h3 className="text-xl font-bold mb-2">{strategy.name}</h3>
                        <p className="text-muted-foreground text-sm mb-6 flex-1">
                            {strategy.description}
                        </p>

                        <div className="flex flex-wrap gap-2 mb-6">
                            {strategy.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="bg-accent text-accent-foreground text-xs font-normal">
                                    #{tag}
                                </Badge>
                            ))}
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                            <span className={`text-sm font-semibold ${strategy.riskLevel === 'High' ? 'text-destructive' :
                                    strategy.riskLevel === 'Medium' ? 'text-chart-4' : 'text-chart-2'
                                }`}>
                                {strategy.riskLevel} Risk
                            </span>
                            <Button size="sm" variant="default" className="bg-accent hover:bg-accent/80 text-foreground gap-2">
                                <Play size={14} /> Run Backtest
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

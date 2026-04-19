'use client';

import { mockStocks } from '@/data/mocks';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';

export function StockDetailView({ ticker }: { ticker: string }) {
    const stock = mockStocks.find(s => s.ticker === ticker) || mockStocks[0];
    const isPositive = stock.change >= 0;

    return (
        <div className="flex flex-col gap-6 p-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <div className="flex items-center gap-3">
                        <h1 className="text-4xl font-bold tracking-tight">{stock.ticker}</h1>
                        <Badge variant="outline" className="text-muted-foreground">{stock.marketOpen ? 'MARKET OPEN' : 'MARKET CLOSED'}</Badge>
                    </div>
                    <p className="text-xl text-muted-foreground mt-1">{stock.name}</p>
                </div>
                <div className="text-right">
                    <div className="text-4xl font-bold">${stock.price.toFixed(2)}</div>
                    <div className={`flex items-center justify-end gap-2 text-lg font-medium ${isPositive ? 'text-chart-2' : 'text-destructive'}`}>
                        {isPositive ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
                        {stock.change > 0 ? '+' : ''}{stock.change} ({stock.changePercent}%)
                    </div>
                </div>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="chart" className="w-full">
                <TabsList className="bg-muted w-full justify-start h-12 p-1">
                    <TabsTrigger value="chart" className="h-full px-6">Chart</TabsTrigger>
                    <TabsTrigger value="financials" className="h-full px-6">Financials</TabsTrigger>
                    <TabsTrigger value="news" className="h-full px-6">News</TabsTrigger>
                    <TabsTrigger value="analysis" className="h-full px-6 text-primary">AI Analysis</TabsTrigger>
                </TabsList>

                <TabsContent value="chart" className="mt-6">
                    <Card className="p-6 h-[500px] flex items-center justify-center bg-card border-border">
                        <div className="text-muted-foreground flex flex-col items-center gap-2">
                            <Activity size={48} />
                            <span>Interactive Chart Placeholder for {stock.ticker}</span>
                        </div>
                    </Card>
                </TabsContent>

                <TabsContent value="financials" className="mt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        {['Market Cap', 'P/E Ratio', 'Dividend Yield', 'EPS'].map(metric => (
                            <Card key={metric} className="p-6 bg-card border-border">
                                <div className="text-sm text-muted-foreground mb-1">{metric}</div>
                                <div className="text-2xl font-bold">---</div>
                            </Card>
                        ))}
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}

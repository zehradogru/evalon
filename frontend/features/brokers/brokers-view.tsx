'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Star, ExternalLink, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

const brokers = [
    {
        name: 'Interactive Brokers',
        rating: 4.8,
        tags: ['Global', 'Low Fees', 'Pro Tools'],
        description: 'Best for professional traders requiring access to global markets and advanced order types.',
        link: '#',
        popular: true
    },
    {
        name: 'TD Ameritrade',
        rating: 4.6,
        tags: ['Beginner Friendly', 'Education', 'ThinkOrSwim'],
        description: 'Excellent educational resources and the powerful ThinkOrSwim platform.',
        link: '#',
        popular: false
    },
    {
        name: 'Robinhood',
        rating: 4.2,
        tags: ['Commission Free', 'Simple UI', 'Mobile First'],
        description: 'User-friendly mobile app for commission-free stock and crypto trading.',
        link: '#',
        popular: false
    },
    {
        name: 'Binance',
        rating: 4.7,
        tags: ['Crypto', 'High Volume', 'staking'],
        description: 'Leading cryptocurrency exchange with the highest trading volume and many pairs.',
        link: '#',
        popular: true
    },
    {
        name: 'Midas',
        rating: 4.5,
        tags: ['Turkish Stocks', 'US Stocks', 'Low Commission'],
        description: 'Easy investment in BIST and US markets for Turkish users.',
        link: '#',
        popular: true
    }
];

export function BrokersView() {
    return (
        <div className="space-y-6 pt-6 pb-12">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Integration Partners & Brokers</h1>
                <p className="text-muted-foreground">Connect your preferred brokerage accounts for seamless trading execution.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {brokers.map((broker) => (
                    <Card key={broker.name} className="flex flex-col gap-4 p-6 border-border hover:border-primary/50 transition-colors bg-card relative overflow-hidden group">
                        {broker.popular && (
                            <div className="absolute top-0 right-0 bg-primary/20 text-primary text-[10px] font-bold px-2 py-1 rounded-bl-lg">
                                POPULAR
                            </div>
                        )}
                        <div className="flex items-start justify-between">
                            <div className="h-12 w-12 rounded-lg bg-secondary flex items-center justify-center font-bold text-lg text-foreground">
                                {broker.name[0]}
                            </div>
                            <div className="flex items-center gap-1 bg-secondary/50 px-2 py-1 rounded">
                                <Star size={12} className="text-chart-4 fill-chart-4" />
                                <span className="text-xs font-medium">{broker.rating}</span>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <h3 className="font-bold text-lg">{broker.name}</h3>
                            <p className="text-sm text-muted-foreground line-clamp-2 min-h-[40px]">
                                {broker.description}
                            </p>
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {broker.tags.map(tag => (
                                <Badge key={tag} variant="secondary" className="text-[10px] bg-secondary text-secondary-foreground hover:bg-secondary/80">
                                    {tag}
                                </Badge>
                            ))}
                        </div>

                        <div className="pt-2 mt-auto">
                            <Button className="w-full gap-2" variant="outline">
                                Connect <ExternalLink size={14} />
                            </Button>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
}

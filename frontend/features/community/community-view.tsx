'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { MessageSquare, ThumbsUp, Share2, MoreHorizontal, User } from 'lucide-react';
import { cn } from '@/lib/utils';

const discussions = [
    {
        id: 1,
        author: 'CryptoKing',
        title: 'Bitcoin halving impact on altcoins - My thoughts',
        content: 'Historical data suggests a strong correlation between BTC dominance drop and altcoin season post-halving. Here is my chart analysis...',
        likes: 124,
        comments: 45,
        tags: ['Bitcoin', 'Strategy', 'Crypto'],
        time: '2h ago'
    },
    {
        id: 2,
        author: 'SarahTrades',
        title: 'NVIDIA earnings preview: What to expect',
        content: 'Analysts are expecting another blowout quarter. The implied move is around 8%. Are you buying calls or puts?',
        likes: 89,
        comments: 112,
        tags: ['Stocks', 'Earnings', 'NVDA'],
        time: '4h ago'
    },
    {
        id: 3,
        author: 'MacroGuru',
        title: 'Fed pivot is inevitable in 2024',
        content: 'With inflation cooling down and unemployment ticking up, the Fed has no choice but to cut rates by Q3.',
        likes: 256,
        comments: 78,
        tags: ['Macro', 'Economy', 'Forex'],
        time: '6h ago'
    },
    {
        id: 4,
        author: 'TechInvestor',
        title: 'Tesla robotaxi event - Hype or Reality?',
        content: 'The autonomous driving technology is impressive but regulatory hurdles remain massive. Is the stock overpriced?',
        likes: 150,
        comments: 67,
        tags: ['TSLA', 'Tech', 'EV'],
        time: '1d ago'
    }
];

export function CommunityView() {
    return (
        <div className="space-y-6 pt-6 pb-12">
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                    <div className="space-y-0.5">
                        <h1 className="text-3xl font-bold tracking-tight">Community Hub</h1>
                        <p className="text-muted-foreground">Join the conversation with thousands of traders.</p>
                    </div>
                    <Button>Start Discussion</Button>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Main Feed */}
                <div className="lg:col-span-3 space-y-4">
                    {discussions.map((post) => (
                        <Card key={post.id} className="p-6 border-border hover:bg-accent/5 transition-colors cursor-pointer group">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="h-10 w-10 rounded-full bg-secondary flex items-center justify-center">
                                        <User size={20} className="text-muted-foreground" />
                                    </div>
                                    <div>
                                        <div className="font-semibold text-sm hover:underline">{post.author}</div>
                                        <div className="text-xs text-muted-foreground">{post.time}</div>
                                    </div>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground"><MoreHorizontal size={16} /></Button>
                            </div>

                            <div className="space-y-2 mb-4">
                                <h3 className="text-lg font-bold group-hover:text-primary transition-colors">{post.title}</h3>
                                <p className="text-sm text-foreground/80 line-clamp-2">{post.content}</p>
                            </div>

                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    {post.tags.map(tag => (
                                        <Badge key={tag} variant="outline" className="text-[10px] h-5 border-border text-muted-foreground">{tag}</Badge>
                                    ))}
                                </div>
                                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                    <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                                        <ThumbsUp size={16} /> {post.likes}
                                    </button>
                                    <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                                        <MessageSquare size={16} /> {post.comments}
                                    </button>
                                    <button className="flex items-center gap-1.5 hover:text-foreground transition-colors">
                                        <Share2 size={16} /> Share
                                    </button>
                                </div>
                            </div>
                        </Card>
                    ))}
                </div>

                {/* Sidebar */}
                <div className="hidden lg:block space-y-6">
                    <Card className="p-4 border-border space-y-4">
                        <h3 className="font-semibold text-sm">Trending Topics</h3>
                        <div className="flex flex-wrap gap-2">
                            {['Bitcoin', 'NVIDIA', 'Gold', 'Fed Rate', 'Earnings', 'AI'].map(tag => (
                                <Badge key={tag} className="bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer">#{tag}</Badge>
                            ))}
                        </div>
                    </Card>

                    <Card className="p-4 border-border space-y-4">
                        <h3 className="font-semibold text-sm">Top Contributors</h3>
                        <div className="space-y-3">
                            {['CryptoKing', 'StockMaster', 'ForexPro'].map((user, i) => (
                                <div key={user} className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        {/* <span className="text-xs font-mono text-muted-foreground">{i + 1}</span> */}
                                        <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
                                            {user[0]}
                                        </div>
                                        <span className="text-sm font-medium">{user}</span>
                                    </div>
                                    <span className="text-xs text-muted-foreground">{1200 - (i * 150)} pts</span>
                                </div>
                            ))}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
}

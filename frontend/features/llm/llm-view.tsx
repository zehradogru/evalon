'use client';

import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Bot, User } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export interface LLMViewProps {
    isWidget?: boolean;
}

export function LLMView({ isWidget = false }: LLMViewProps) {
    const [input, setInput] = useState('');
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hello! I am Evalon AI.' }
    ]);

    const handleSend = () => {
        if (!input.trim()) return;
        setMessages([...messages, { role: 'user', content: input }]);
        setInput('');
        setTimeout(() => {
            setMessages(prev => [...prev, { role: 'assistant', content: 'This is a mock response.' }]);
        }, 1000);
    };

    return (
        <div className={cn("flex flex-col gap-4", isWidget ? "h-full bg-background" : "h-[calc(100vh-64px)] p-6")}>
            {!isWidget && (
                <div className="flex flex-col gap-2">
                    <h1 className="text-3xl font-bold tracking-tight">Evalon AI</h1>
                    <p className="text-muted-foreground">Ask questions about market trends.</p>
                </div>
            )}

            {isWidget && (
                <div className="flex items-center justify-between px-4 pt-4 pb-2 border-b border-border sticky top-0 bg-background z-10">
                    <span className="font-semibold text-sm flex items-center gap-2">Evalon AI</span>
                </div>
            )}

            <div className={cn("flex-1 flex flex-col overflow-hidden border-border bg-card", isWidget ? "border-0" : "border rounded-xl")}>
                <ScrollArea className="flex-1 p-4">
                    <div className="flex flex-col gap-4">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                                <div className={`h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0 ${msg.role === 'assistant' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'
                                    }`}>
                                    {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                                </div>
                                <div className={`p-2 rounded-lg max-w-[80%] text-xs ${msg.role === 'assistant' ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground'
                                    }`}>
                                    {msg.content}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-3 border-t border-border flex gap-2">
                    <Input
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Ask..."
                        className="bg-background border-border h-8 text-xs"
                    />
                    <Button onClick={handleSend} size="icon" className="h-8 w-8 bg-primary hover:bg-primary/90 text-white">
                        <Send size={14} />
                    </Button>
                </div>
            </div>
        </div>
    );
}

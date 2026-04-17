'use client'

import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bot, Loader2, Send, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select } from '@/components/ui/select-native'
import { cn } from '@/lib/utils'
import { readActiveBlueprint } from '@/lib/workspace-storage'
import { aiService } from '@/services/ai.service'
import { useAuthStore } from '@/store/use-auth-store'
import type { AiRequestContext, Timeframe } from '@/types'

export interface LLMViewProps {
  isWidget?: boolean
}

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']

export function LLMView({ isWidget = false }: LLMViewProps) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [title, setTitle] = useState('Trend stratejisi arastirmasi')
  const [input, setInput] = useState('')
  const [ticker, setTicker] = useState('THYAO')
  const [timeframe, setTimeframe] = useState<Timeframe>('1h')
  const [indicatorId, setIndicatorId] = useState('rsi')
  const [selectedSymbols, setSelectedSymbols] = useState('THYAO')
  const [autoSaveDrafts, setAutoSaveDrafts] = useState(true)
  const [lastDraftKind, setLastDraftKind] = useState<'strategies' | 'rules' | 'indicators' | null>(null)

  const toolsQuery = useQuery({
    queryKey: ['ai-tools'],
    queryFn: () => aiService.getTools(),
    staleTime: 300000,
  })
  const assetsQuery = useQuery({
    queryKey: ['ai-assets', user?.id],
    queryFn: () => aiService.getAssets(user!.id),
    enabled: Boolean(user?.id),
  })
  const sessionQuery = useQuery({
    queryKey: ['ai-session', sessionId],
    queryFn: () => aiService.getSession(sessionId!),
    enabled: Boolean(sessionId),
  })

  const createSessionMutation = useMutation({
    mutationFn: () => aiService.createSession(user!.id, title),
    onSuccess: (result) => setSessionId(result.sessionId),
  })

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      let activeSessionId = sessionId
      if (!activeSessionId) {
        const created = await aiService.createSession(user!.id, title)
        activeSessionId = created.sessionId
        setSessionId(created.sessionId)
      }

      const activeBlueprint = readActiveBlueprint()
      const context: AiRequestContext = {
        user_id: user!.id,
        ticker,
        timeframe,
        indicator_id: indicatorId,
        active_blueprint: activeBlueprint
          ? (activeBlueprint as unknown as Record<string, unknown>)
          : undefined,
        selected_symbols: selectedSymbols.split(',').map((item) => item.trim()).filter(Boolean),
        auto_save_drafts: autoSaveDrafts,
      }

      return aiService.sendMessage(activeSessionId!, input, context)
    },
    onSuccess: (result) => {
      setInput('')
      setLastDraftKind(result.drafts.strategy ? 'strategies' : result.drafts.rule ? 'rules' : result.drafts.indicator ? 'indicators' : null)
      void queryClient.invalidateQueries({ queryKey: ['ai-session', sessionId] })
      void queryClient.invalidateQueries({ queryKey: ['ai-assets', user?.id] })
    },
  })

  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const response = sendMessageMutation.data
      if (!response || !user || !lastDraftKind) throw new Error('Kaydedilecek bir draft yok.')
      if (lastDraftKind === 'strategies' && response.drafts.strategy) {
        return aiService.saveAsset('strategies', {
          userId: user.id,
          title: response.drafts.strategy.title,
          description: response.drafts.strategy.description,
          prompt: input,
          spec: response.drafts.strategy as unknown as Record<string, unknown>,
        })
      }
      if (lastDraftKind === 'rules' && response.drafts.rule) {
        return aiService.saveAsset('rules', {
          userId: user.id,
          title: response.drafts.rule.title,
          description: response.drafts.rule.description,
          prompt: input,
          spec: response.drafts.rule as unknown as Record<string, unknown>,
        })
      }
      if (lastDraftKind === 'indicators' && response.drafts.indicator) {
        return aiService.saveAsset('indicators', {
          userId: user.id,
          title: response.drafts.indicator.title,
          description: response.drafts.indicator.description,
          prompt: input,
          spec: response.drafts.indicator as unknown as Record<string, unknown>,
        })
      }
      throw new Error('Draft kayit verisi bulunamadi.')
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['ai-assets', user?.id] })
    },
  })

  const messages = useMemo(() => sessionQuery.data?.messages || [], [sessionQuery.data])

  if (!user) {
    return <div className={cn('flex flex-col gap-4', isWidget ? 'h-full bg-background p-4' : 'h-[calc(100vh-64px)] p-6')}>
      <Card className="border-border bg-card p-6 text-sm text-muted-foreground">Evalon AI ve draft asset kayitlari icin once giris yapman gerekiyor.</Card>
    </div>
  }

  return <div className={cn('flex flex-col gap-4', isWidget ? 'h-full bg-background p-4' : 'h-[calc(100vh-64px)] p-6')}>
    {!isWidget && <div className="flex flex-col gap-2"><h1 className="text-3xl font-bold tracking-tight">Evalon AI</h1><p className="text-muted-foreground">Session, tool catalog, draft ve asset akislari artik gercek backend uzerinden calisiyor.</p></div>}

    <div className="grid gap-4 xl:grid-cols-[1.7fr_1fr]">
      <div className={cn('flex flex-col overflow-hidden border border-border bg-card', isWidget ? 'rounded-xl' : 'rounded-xl')}>
        <div className="border-b border-border p-4">
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-2 text-xs"><span className="text-muted-foreground">Session Title</span><Input value={title} onChange={(event) => setTitle(event.target.value)} className="h-9" /></label>
            <label className="flex flex-col gap-2 text-xs"><span className="text-muted-foreground">Ticker</span><Input value={ticker} onChange={(event) => setTicker(event.target.value.toUpperCase())} className="h-9" /></label>
            <label className="flex flex-col gap-2 text-xs"><span className="text-muted-foreground">Timeframe</span><Select value={timeframe} onChange={(event) => setTimeframe(event.target.value as Timeframe)}>{TIMEFRAMES.map((item) => <option key={item} value={item}>{item}</option>)}</Select></label>
            <label className="flex flex-col gap-2 text-xs"><span className="text-muted-foreground">Indicator</span><Input value={indicatorId} onChange={(event) => setIndicatorId(event.target.value)} className="h-9" /></label>
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto_auto]">
            <Input value={selectedSymbols} onChange={(event) => setSelectedSymbols(event.target.value.toUpperCase())} placeholder="THYAO, GARAN" className="h-9 text-xs" />
            <label className="flex items-center gap-2 text-xs text-muted-foreground"><input type="checkbox" checked={autoSaveDrafts} onChange={(event) => setAutoSaveDrafts(event.target.checked)} /> Auto save drafts</label>
            <Button type="button" variant="outline" size="sm" onClick={() => createSessionMutation.mutate()} disabled={createSessionMutation.isPending}>{createSessionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'New Session'}</Button>
          </div>
        </div>

        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-4">
            {messages.length === 0 && <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">Henüz mesaj yok. Konusmayi baslatmak icin asagidan mesaj gonder.</div>}
            {messages.map((msg) => <div key={msg.id} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}><div className={`flex h-7 w-7 items-center justify-center rounded-full ${msg.role === 'assistant' ? 'bg-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'}`}>{msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}</div><div className={`max-w-[82%] rounded-lg p-3 text-sm ${msg.role === 'assistant' ? 'bg-secondary text-foreground' : 'bg-primary text-primary-foreground'}`}><div>{msg.content}</div><div className="mt-2 text-[10px] opacity-70">{new Date(msg.created_at * 1000).toLocaleString('tr-TR')}</div></div></div>)}
          </div>
        </ScrollArea>

        <div className="border-t border-border p-3">
          <div className="flex gap-2">
            <Input value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && !event.shiftKey && input.trim() && void sendMessageMutation.mutate()} placeholder="THYAO icin 1 saatlik RSI tabanli strateji cikar..." className="bg-background border-border" />
            <Button onClick={() => sendMessageMutation.mutate()} disabled={!input.trim() || sendMessageMutation.isPending}>{sendMessageMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send size={14} />}</Button>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <Card className="border-border bg-card">
          <div className="border-b border-border p-4 text-sm font-semibold">AI Output</div>
          <div className="space-y-3 p-4 text-sm">
            <div><span className="text-muted-foreground">Session:</span> {sessionId || 'not created'}</div>
            <div><span className="text-muted-foreground">Tools:</span> {toolsQuery.data?.count || 0}</div>
            {sendMessageMutation.data?.plan && <div className="rounded-lg border border-border/70 bg-background/60 p-3"><div className="text-xs text-muted-foreground">Intent</div><div className="mt-1 font-medium">{sendMessageMutation.data.plan.intent}</div></div>}
            {sendMessageMutation.data?.toolResults?.length ? <div className="rounded-lg border border-border/70 bg-background/60 p-3"><div className="text-xs text-muted-foreground">Tool Results</div><div className="mt-1 text-xs leading-6">{sendMessageMutation.data.toolResults.map((item) => String(item.tool || item.name || 'tool')).join(', ')}</div></div> : null}
            {sendMessageMutation.data?.errors?.length ? <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">{sendMessageMutation.data.errors.join(' | ')}</div> : null}
            <Button type="button" variant="outline" size="sm" onClick={() => saveDraftMutation.mutate()} disabled={!lastDraftKind || saveDraftMutation.isPending}>{saveDraftMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Latest Draft Again'}</Button>
          </div>
        </Card>

        <Card className="border-border bg-card">
          <div className="border-b border-border p-4 text-sm font-semibold">Saved Assets</div>
          <div className="space-y-3 p-4 text-sm">
            <div>Strategies: {assetsQuery.data?.counts?.strategies || 0}</div>
            <div>Rules: {assetsQuery.data?.counts?.rules || 0}</div>
            <div>Indicators: {assetsQuery.data?.counts?.indicators || 0}</div>
          </div>
        </Card>
      </div>
    </div>
  </div>
}

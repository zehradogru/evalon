'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BarChart2,
  Bot,
  ChevronDown,
  ChevronRight,
  Copy,
  GitBranch,
  Lightbulb,
  Loader2,
  MessageSquare,
  PanelLeftClose,
  Trash2,
  X,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Send,
  Sparkles,
  TrendingUp,
  User,
  Zap,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select } from '@/components/ui/select-native'
import { cn } from '@/lib/utils'
import { readActiveBlueprint } from '@/lib/workspace-storage'
import { aiService } from '@/services/ai.service'
import { aiHistoryService } from '@/services/ai-history.service'
import { useAuthStore } from '@/store/use-auth-store'
import type { AiAsset, AiMessage, AiMessageResponse, AiRequestContext, Timeframe } from '@/types'
import { BIST_AVAILABLE, TICKER_NAMES } from '@/config/markets'
import { BacktestToolResult } from './backtest-tool-result'

// ─── Types ───────────────────────────────────────────────────────────────────

interface SessionEntry {
  id: string
  title: string
  createdAt: number
}

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEFRAMES: Timeframe[] = ['1m', '5m', '15m', '1h', '4h', '1d', '1w', '1M']

const QUICK_PROMPTS = [
  {
    label: 'Suggest Strategy',
    prompt: 'Suggest a 1-hour RSI-based trading strategy for THYAO',
    icon: Lightbulb,
    gradient: 'from-blue-500/20 to-indigo-500/20 border-blue-500/30',
    iconColor: 'text-blue-400',
  },
  {
    label: 'Run Backtest',
    prompt: 'Create an EMA crossover strategy for GARAN and backtest it',
    icon: BarChart2,
    gradient: 'from-emerald-500/20 to-teal-500/20 border-emerald-500/30',
    iconColor: 'text-emerald-400',
  },
  {
    label: 'Indicator Analysis',
    prompt: 'Calculate and interpret daily MACD and RSI indicators for BIMAS',
    icon: TrendingUp,
    gradient: 'from-purple-500/20 to-pink-500/20 border-purple-500/30',
    iconColor: 'text-purple-400',
  },
  {
    label: 'Rule Set',
    prompt: 'Create an entry-exit rule set for momentum breakout',
    icon: GitBranch,
    gradient: 'from-orange-500/20 to-amber-500/20 border-orange-500/30',
    iconColor: 'text-orange-400',
  },
]

// ─── Message Content Renderer ─────────────────────────────────────────────────

function MessageContent({ content }: { content: string }) {
  const parts = content.split(/(```[\s\S]*?```)/g)
  return (
    <div className="text-sm leading-relaxed space-y-1">
      {parts.map((part, i) => {
        if (part.startsWith('```')) {
          const lines = part.split('\n')
          const lang = lines[0].replace('```', '').trim()
          const code = lines.slice(1, lines.length - 1).join('\n')
          return (
            <div key={i} className="my-2 rounded-lg overflow-hidden border border-white/10">
              {lang && (
                <div className="px-3 py-1.5 bg-white/5 text-[10px] text-muted-foreground font-mono border-b border-white/10">
                  {lang}
                </div>
              )}
              <pre className="p-3 text-xs font-mono overflow-x-auto bg-black/30 whitespace-pre-wrap text-slate-200">
                {code}
              </pre>
            </div>
          )
        }
        return (
          <span key={i}>
            {part.split('\n').map((line, li) => {
              const boldParts = line.split(/(\*\*[^*]+\*\*)/g)
              return (
                <span key={li}>
                  {li > 0 && <br />}
                  {boldParts.map((seg, si) =>
                    seg.startsWith('**') && seg.endsWith('**') ? (
                      <strong key={si} className="font-semibold text-foreground">
                        {seg.slice(2, -2)}
                      </strong>
                    ) : (
                      <span key={si}>{seg}</span>
                    )
                  )}
                </span>
              )
            })}
          </span>
        )
      })}
    </div>
  )
}

// ─── Chat Message Bubble ──────────────────────────────────────────────────────

function ChatMessage({
  msg,
  onActionClick,
}: {
  msg: AiMessage
  onActionClick?: (action: string) => void
}) {
  const [copied, setCopied] = useState(false)
  const [toolsExpanded, setToolsExpanded] = useState(true)
  const isAssistant = msg.role === 'assistant'

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }, [msg.content])

  const toolResults = (msg.metadata?.toolResults as Array<Record<string, unknown>>) || null
  const drafts = (msg.metadata?.drafts as Record<string, unknown>) || null
  const hasDrafts = drafts && (drafts.strategy || drafts.rule || drafts.indicator)
  const suggestedActions = (msg.metadata?.suggestedActions as string[]) || null

  return (
    <div className={cn('group flex items-start gap-3', isAssistant ? '' : 'flex-row-reverse')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold',
          isAssistant
            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
            : 'bg-secondary text-secondary-foreground'
        )}
      >
        {isAssistant ? <Bot size={13} /> : <User size={13} />}
      </div>

      {/* Bubble */}
      <div className={cn('flex flex-col gap-1.5 max-w-[82%]', isAssistant ? '' : 'items-end')}>
        <div
          className={cn(
            'rounded-2xl px-4 py-3 relative',
            isAssistant
              ? 'bg-secondary/60 border border-border/50 text-foreground rounded-tl-sm'
              : 'bg-primary text-primary-foreground rounded-tr-sm'
          )}
        >
          <MessageContent content={msg.content} />

          {/* Copy button */}
          <button
            onClick={handleCopy}
            className={cn(
              'absolute -top-2 -right-2 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm',
              copied && 'opacity-100'
            )}
          >
            <Copy size={10} className={copied ? 'text-primary' : 'text-muted-foreground'} />
          </button>
        </div>

        {/* Tool results */}
        {toolResults && toolResults.length > 0 && (
          <div className="w-full">
            <button
              onClick={() => setToolsExpanded((p) => !p)}
              className="flex items-center gap-1.5 text-[11px] text-muted-foreground hover:text-foreground transition-colors px-1"
            >
              {toolsExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              <Zap size={10} className="text-yellow-400" />
              {toolResults.length} tools run
            </button>
            {toolsExpanded && (
              <div className="mt-1.5 space-y-1.5">
                {toolResults.map((tr, i) => {
                  const toolName = String(tr.tool || tr.name || `tool_${i}`)
                  const result = (tr.result ?? null) as Record<string, unknown> | null
                  const runId =
                    toolName === 'run_backtest'
                      ? typeof result?.runId === 'string'
                        ? result.runId
                        : typeof result?.run_id === 'string'
                          ? (result.run_id as string)
                          : null
                      : null

                  if (runId) {
                    return <BacktestToolResult key={i} runId={runId} initialResult={result} />
                  }

                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-border/50 bg-black/20 px-3 py-2 text-[11px] font-mono text-muted-foreground"
                    >
                      <span className="text-yellow-400 font-semibold">{toolName}</span>
                      {tr.status !== undefined && (
                        <span
                          className={cn(
                            'ml-2',
                            tr.status === 'ok' || tr.status === 'success'
                              ? 'text-emerald-400'
                              : 'text-red-400'
                          )}
                        >
                          {String(tr.status)}
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Draft badge */}
        {hasDrafts && (
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 px-1">
            <Sparkles size={10} />
            {drafts?.strategy && <span>Strategy draft created</span>}
            {drafts?.rule && <span>Rule draft created</span>}
            {drafts?.indicator && <span>Indicator draft created</span>}
          </div>
        )}

        {/* Suggested Actions */}
        {suggestedActions && suggestedActions.length > 0 && isAssistant && (
          <div className="flex flex-wrap gap-2 mt-2 px-1">
            {suggestedActions.map((action, i) => (
              <button
                key={i}
                onClick={() => onActionClick?.(action)}
                className="text-xs px-3 py-1.5 rounded-full bg-secondary/50 hover:bg-secondary border border-border/50 hover:border-border text-foreground transition-all text-left"
              >
                {action}
              </button>
            ))}
          </div>
        )}

        {/* Timestamp */}
        <span className="text-[10px] text-muted-foreground/50 px-1">
          {new Date(msg.created_at * 1000).toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
    </div>
  )
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState({ onPromptSelect }: { onPromptSelect: (prompt: string) => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-8 px-6 py-12">
      {/* Logo */}
      <div className="flex flex-col items-center gap-4">
        <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Bot size={28} className="text-white" />
        </div>
        <div className="text-center">
          <h2 className="text-xl font-semibold text-foreground">Evalon AI</h2>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Develop strategies, run backtests, analyze indicators
          </p>
        </div>
      </div>

      {/* Quick prompts */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-lg">
        {QUICK_PROMPTS.map((qp) => (
          <button
            key={qp.label}
            onClick={() => onPromptSelect(qp.prompt)}
            className={cn(
              'flex flex-col gap-2 p-4 rounded-xl border bg-gradient-to-br text-left hover:scale-[1.02] active:scale-[0.98] transition-all duration-150',
              qp.gradient
            )}
          >
            <qp.icon size={16} className={qp.iconColor} />
            <div>
              <div className="text-xs font-semibold text-foreground">{qp.label}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed line-clamp-2">
                {qp.prompt}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Asset Card ───────────────────────────────────────────────────────────────

function AssetCard({ asset }: { asset: AiAsset }) {
  const [expanded, setExpanded] = useState(false)
  const kindColor =
    asset.kind === 'strategy'
      ? 'text-blue-400'
      : asset.kind === 'rule'
        ? 'text-emerald-400'
        : 'text-purple-400'

  return (
    <div className="rounded-lg border border-border/50 bg-card/50 overflow-hidden">
      <button
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-secondary/30 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className={cn('text-[10px] font-bold uppercase tracking-wider', kindColor)}>
            {asset.kind}
          </span>
          <span className="text-xs text-foreground font-medium truncate">{asset.title}</span>
        </div>
        <ChevronDown
          size={12}
          className={cn(
            'flex-shrink-0 text-muted-foreground transition-transform',
            expanded && 'rotate-180'
          )}
        />
      </button>
      {expanded && (
        <div className="px-3 pb-3 text-[11px] text-muted-foreground border-t border-border/50 pt-2.5 space-y-1">
          <p>{asset.description || 'No description'}</p>
          {asset.prompt && (
            <p className="text-[10px] italic text-muted-foreground/60 line-clamp-2">
              &ldquo;{asset.prompt}&rdquo;
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Symbol Picker ──────────────────────────────────────────────────────────

function SymbolPicker({
  value,
  onChange,
}: {
  value: string[]
  onChange: (symbols: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const suggestions = useMemo(() => {
    const q = query.toUpperCase().trim()
    if (!q) return []
    return BIST_AVAILABLE.filter(
      (t) =>
        !value.includes(t) &&
        (t.includes(q) || (TICKER_NAMES[t] ?? '').toUpperCase().includes(q))
    ).slice(0, 8)
  }, [query, value])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function addSymbol(ticker: string) {
    if (!value.includes(ticker)) onChange([...value, ticker])
    setQuery('')
    setOpen(false)
  }

  function removeSymbol(ticker: string) {
    onChange(value.filter((s) => s !== ticker))
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && suggestions.length > 0) {
      e.preventDefault()
      addSymbol(suggestions[0])
    }
    if (e.key === 'Backspace' && query === '' && value.length > 0) {
      removeSymbol(value[value.length - 1])
    }
  }

  return (
    <div ref={containerRef} className="relative">
      {/* Selected chips */}
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {value.map((sym) => (
            <span
              key={sym}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-primary/15 border border-primary/30 text-[11px] text-primary font-medium"
            >
              {sym}
              <button
                type="button"
                onClick={() => removeSymbol(sym)}
                className="text-primary/60 hover:text-primary transition-colors"
              >
                <X size={10} />
              </button>
            </span>
          ))}
        </div>
      )}
      {/* Search input */}
      <Input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value.toUpperCase())
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={value.length === 0 ? 'Ara: THYAO, GARAN…' : 'Ekle…'}
        className="h-8 text-xs bg-secondary/40 border-border/50"
      />
      {/* Dropdown */}
      {open && suggestions.length > 0 && (
        <div className="absolute z-50 top-full mt-1 w-full rounded-md border border-border bg-background shadow-lg overflow-hidden">
          {suggestions.map((t) => (
            <button
              key={t}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); addSymbol(t) }}
              className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-secondary/60 transition-colors text-left"
            >
              <span className="font-medium text-foreground">{t}</span>
              <span className="text-muted-foreground truncate ml-2">{TICKER_NAMES[t] ?? ''}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main View ────────────────────────────────────────────────────────────────

export interface AiAssistantViewProps {
  isWidget?: boolean
}

export function AiAssistantView({ isWidget = false }: AiAssistantViewProps) {
  const queryClient = useQueryClient()
  const user = useAuthStore((state) => state.user)

  // Layout state
  const [historyOpen, setHistoryOpen] = useState(!isWidget)
  const [contextOpen, setContextOpen] = useState(!isWidget)

  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessions, setSessions] = useState<SessionEntry[]>([])
  const [localMessages, setLocalMessages] = useState<AiMessage[]>([])
  const [messagesLoading, setMessagesLoading] = useState(false)

  // Load session list from Firestore on mount
  useEffect(() => {
    if (!user) return
    aiHistoryService.getSessions(user.id).then((stored) => {
      // Map StoredAiSession (sessionId) → SessionEntry (id)
      setSessions(stored.map((s) => ({
        id: s.sessionId ?? (s as unknown as SessionEntry).id ?? '',
        title: s.title,
        createdAt: s.createdAt,
      })))
    }).catch(() => {})
  }, [user])

  // Input & context
  const [input, setInput] = useState('')
  const [sessionTitle, setSessionTitle] = useState('Yeni Oturum')
  const [ticker, setTicker] = useState('THYAO')
  const [timeframe, setTimeframe] = useState<Timeframe>('1h')
  const [indicatorId, setIndicatorId] = useState('rsi')
  const [selectedSymbols, setSelectedSymbols] = useState<string[]>(['THYAO'])
  const [autoSaveDrafts, setAutoSaveDrafts] = useState(false)

  // Latest response for inline tool results
  const [latestResponse, setLatestResponse] = useState<AiMessageResponse | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Queries
  const toolsQuery = useQuery({
    queryKey: ['ai-tools'],
    queryFn: () => aiService.getTools(),
    staleTime: 300_000,
  })

  const sessionQuery = useQuery({
    queryKey: ['ai-session', sessionId],
    queryFn: () => aiService.getSession(sessionId!),
    enabled: false, // messages come from Firestore, not backend
    refetchInterval: false,
  })

  const assetsQuery = useQuery({
    queryKey: ['ai-assets', user?.id],
    queryFn: () => aiService.getAssets(user!.id),
    enabled: Boolean(user?.id),
  })

  const messages: AiMessage[] = localMessages

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: () => aiService.createSession(user!.id, 'Yeni Oturum'),
    onSuccess: (result) => {
      const entry: SessionEntry = {
        id: result.sessionId,
        title: 'Yeni Oturum',
        createdAt: result.createdAt,
      }
      setSessions((prev) => [entry, ...prev])
      setSessionId(result.sessionId)
      setLocalMessages([])
      setLatestResponse(null)
      setInput('')
      setSessionTitle('Yeni Oturum')
      // Persist to Firestore
      void aiHistoryService.saveSession(user!.id, {
        sessionId: result.sessionId,
        title: 'Yeni Oturum',
        createdAt: result.createdAt,
      })
    },
  })

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (payload: { text: string; userMsg: AiMessage }) => {
      const { text } = payload
      let activeId = sessionId

      // Auto-create session if none exists
      if (!activeId) {
        const created = await aiService.createSession(user!.id, sessionTitle)
        activeId = created.sessionId
        const entry: SessionEntry = {
          id: created.sessionId,
          title: sessionTitle,
          createdAt: created.createdAt,
        }
        setSessions((prev) => [entry, ...prev])
        setSessionId(created.sessionId)
        void aiHistoryService.saveSession(user!.id, {
          sessionId: created.sessionId,
          title: entry.title,
          createdAt: entry.createdAt,
        })
      }

      // Only attach the workspace blueprint when the user explicitly opts in
      // (same toggle that allows AI to save drafts). Prevents the AI from
      // auto-saving a "draft" blueprint on every message.
      const activeBlueprint = autoSaveDrafts ? readActiveBlueprint() : null
      const context: AiRequestContext = {
        user_id: user!.id,
        ticker,
        timeframe,
        indicator_id: indicatorId,
        active_blueprint: activeBlueprint
          ? (activeBlueprint as unknown as Record<string, unknown>)
          : undefined,
        selected_symbols: selectedSymbols,
        auto_save_drafts: autoSaveDrafts,
      }

      // Try sending — if backend lost the session (restart/scale-out), recreate once and retry
      try {
        const result = await aiService.sendMessage(activeId, text, context)
        return { result, activeId, userMsg: payload.userMsg }
      } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : ''
        if (msg.includes('not found') || msg.includes('session') || msg.includes('404') || msg.includes('400')) {
          // Session expired on backend — recreate transparently
          const fresh = await aiService.createSession(user!.id, sessionTitle)
          activeId = fresh.sessionId
          const entry: SessionEntry = {
            id: fresh.sessionId,
            title: sessionTitle,
            createdAt: fresh.createdAt,
          }
          setSessions((prev) => [entry, ...prev])
          setSessionId(fresh.sessionId)
          void aiHistoryService.saveSession(user!.id, {
            sessionId: fresh.sessionId,
            title: entry.title,
            createdAt: entry.createdAt,
          })
          const result = await aiService.sendMessage(activeId, text, context)
          return { result, activeId, userMsg: payload.userMsg }
        }
        throw err
      }
    },
    onSuccess: ({ result, activeId, userMsg }) => {
      setInput('')
      setLatestResponse(result)
      
      const enhancedMsg = { ...result.message }
      enhancedMsg.metadata = { ...enhancedMsg.metadata }
      
      if (result.toolResults && result.toolResults.length > 0) {
        enhancedMsg.metadata.toolResults = result.toolResults
      }
      
      if (result.drafts && (result.drafts.strategy || result.drafts.rule || result.drafts.indicator)) {
        enhancedMsg.metadata.drafts = result.drafts
      }
      
      setLocalMessages((prev) => [...prev, enhancedMsg])
      // Auto-title: use first user message (truncated) if still default
      setSessionTitle((prev) => {
        const autoTitle = prev === 'Yeni Oturum' ? userMsg.content.slice(0, 40) : prev
        if (autoTitle !== prev) {
          void aiHistoryService.updateSessionTitle(user!.id, activeId, autoTitle)
          setSessions((s) =>
            s.map((entry) => (entry.id === activeId ? { ...entry, title: autoTitle } : entry))
          )
        }
        return autoTitle
      })
      // Persist both messages to Firestore
      void aiHistoryService.appendMessages(user!.id, activeId, [userMsg, enhancedMsg])
      void queryClient.invalidateQueries({ queryKey: ['ai-assets', user?.id] })
    },
    onError: (_err, { userMsg }) => {
      // Roll back optimistic user message
      setLocalMessages((prev) => prev.filter((m) => m.id !== userMsg.id))
    },
  })

  const handleSend = useCallback((overrideText?: string) => {
    const text = (overrideText ?? input).trim()
    if (!text || sendMutation.isPending) return
    const userMsg: AiMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
      created_at: Math.floor(Date.now() / 1000),
      metadata: {},
    }
    // Optimistically show user message immediately
    setLocalMessages((prev) => [...prev, userMsg])
    sendMutation.mutate({ text, userMsg })
  }, [input, sendMutation])

  const handlePromptSelect = useCallback(
    (prompt: string) => {
      setInput(prompt)
      inputRef.current?.focus()
    },
    []
  )

  const handleNewSession = useCallback(() => {
    setSessionId(null)
    setLocalMessages([])
    setLatestResponse(null)
    setInput('')
    setSessionTitle('Yeni Oturum')
  }, [])

  const handleSwitchSession = useCallback(async (id: string, title: string) => {
    setSessionId(id)
    setSessionTitle(title)
    setLatestResponse(null)
    setInput('')
    setLocalMessages([])
    if (!user) return
    setMessagesLoading(true)
    try {
      const msgs = await aiHistoryService.getMessages(user.id, id)
      setLocalMessages(msgs)
    } catch {
      // ignore
    } finally {
      setMessagesLoading(false)
    }
  }, [user])

  const handleDeleteSession = useCallback(async (id: string) => {
    if (!user) return
    setSessions((prev) => prev.filter((s) => s.id !== id))
    void aiHistoryService.deleteSession(user.id, id)
    if (sessionId === id) {
      setSessionId(null)
      setLocalMessages([])
      setLatestResponse(null)
    }
  }, [user, sessionId])

  // Unauthenticated state
  if (!user) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto">
            <Bot size={20} className="text-white" />
          </div>
          <p className="text-sm text-muted-foreground">
            You need to log in to use Evalon AI.
          </p>
        </div>
      </div>
    )
  }

  // ── Widget mode (shown in dashboard sidebar panel) ──────────────────────────
  if (isWidget) {
    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Bot size={12} className="text-white" />
            </div>
            <span className="text-sm font-semibold">Evalon AI</span>
          </div>
          <button
            onClick={handleNewSession}
            className="h-6 w-6 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>

        {/* Chat area */}
        <ScrollArea className="flex-1 px-3 py-3">
          {messagesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={18} className="animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <Bot size={24} className="mx-auto text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">Start by sending a message</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {messages.map((msg, i) => (
                <ChatMessage
                  key={msg.id}
                  msg={msg}
                />
              ))}
              {sendMutation.isPending && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Bot size={13} className="text-white" />
                  </div>
                  <div className="flex gap-1 px-3 py-2 rounded-2xl bg-secondary/60 rounded-tl-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input */}
        <div className="border-t border-border p-3">
          <div className="flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  handleSend()
                }
              }}
              placeholder="Mesaj yaz..."
              className="h-9 text-sm bg-secondary/40 border-border/50 focus:border-primary/50"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || sendMutation.isPending}
              className="h-9 w-9 flex-shrink-0"
            >
              {sendMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Full page mode ──────────────────────────────────────────────────────────

  const allAssets = [
    ...(assetsQuery.data?.assets?.strategies ?? []),
    ...(assetsQuery.data?.assets?.rules ?? []),
    ...(assetsQuery.data?.assets?.indicators ?? []),
  ]

  return (
    <div className="flex h-[calc(100vh-64px-40px)] bg-background overflow-hidden">
      {/* ── Left Panel: Session History ───────────────────────────────── */}
      <div
        className={cn(
          'flex-shrink-0 border-r border-border flex flex-col bg-card/30 transition-all duration-200 overflow-hidden',
          historyOpen ? 'w-[220px]' : 'w-0 border-r-0'
        )}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-border flex-shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Oturumlar
          </span>
          <button
            onClick={handleNewSession}
            className="h-6 w-6 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
          >
            <Plus size={13} />
          </button>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-0.5">
            {sessions.length === 0 && (
              <p className="text-[11px] text-muted-foreground/50 text-center py-6 px-3">
                No sessions yet
              </p>
            )}
            {sessions.map((session) => (
              <div
                key={session.id}
                className={cn(
                  'group relative w-full rounded-lg text-xs transition-colors',
                  sessionId === session.id
                    ? 'bg-primary/10'
                    : 'hover:bg-secondary/50'
                )}
              >
                <button
                  onClick={() => void handleSwitchSession(session.id, session.title)}
                  className={cn(
                    'w-full text-left px-3 py-2 pr-8 truncate',
                    sessionId === session.id
                      ? 'text-primary font-medium'
                      : 'text-muted-foreground hover:text-foreground'
                  )}
                >
                  <div className="flex items-center gap-2">
                    <MessageSquare size={11} className="flex-shrink-0" />
                    <span className="truncate">{session.title}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/50 mt-0.5 pl-[19px]">
                    {new Date(session.createdAt * 1000).toLocaleDateString('en-US')}
                  </div>
                </button>
                <button
                  onClick={() => void handleDeleteSession(session.id)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity p-1 rounded"
                  title="Sil"
                >
                  <Trash2 size={11} />
                </button>
              </div>
            ))}
          </div>
        </ScrollArea>

        {/* Tools count */}
        <div className="p-3 border-t border-border">
          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
            <Zap size={11} className="text-yellow-400" />
            <span>{toolsQuery.data?.count ?? 0} tools active</span>
          </div>
        </div>
      </div>

      {/* ── Center: Chat Area ─────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Chat toolbar */}
        <div className="flex items-center justify-between px-4 h-12 border-b border-border flex-shrink-0 bg-card/20">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setHistoryOpen((p) => !p)}
              className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title={historyOpen ? 'Hide history' : 'Show history'}
            >
              {historyOpen ? <PanelLeftClose size={14} /> : <PanelLeftOpen size={14} />}
            </button>

            <div className="flex items-center gap-2 ml-1">
              <div className="h-5 w-5 rounded-md bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
                <Bot size={11} className="text-white" />
              </div>
              <input
                type="text"
                value={sessionTitle}
                onChange={(e) => setSessionTitle(e.target.value)}
                onBlur={(e) => {
                  const title = e.target.value.trim() || 'Yeni Oturum'
                  setSessionTitle(title)
                  if (sessionId && user) {
                    void aiHistoryService.updateSessionTitle(user.id, sessionId, title)
                    setSessions((s) =>
                      s.map((entry) => (entry.id === sessionId ? { ...entry, title } : entry))
                    )
                  }
                }}
                className="text-sm font-medium bg-transparent border-none outline-none text-foreground w-40 truncate hover:text-primary focus:text-primary transition-colors"
              />
            </div>

            {sessionId && (
              <span className="text-[10px] text-muted-foreground/50 font-mono hidden sm:inline">
                #{sessionId.slice(0, 8)}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {sendMutation.isError && (
              <span className="text-[11px] text-destructive">
                {sendMutation.error instanceof Error ? sendMutation.error.message : 'An error occurred'}
              </span>
            )}
            <button
              onClick={() => {
                if (sessionId) {
                  void queryClient.invalidateQueries({ queryKey: ['ai-session', sessionId] })
                }
              }}
              className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title="Yenile"
            >
              <span className="sr-only">Yenile</span>
              {sessionQuery.isFetching ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <svg
                  width="13"
                  height="13"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
                  <path d="M21 3v5h-5" />
                  <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
                  <path d="M8 16H3v5" />
                </svg>
              )}
            </button>
            <button
              onClick={() => setContextOpen((p) => !p)}
              className="h-7 w-7 rounded-md hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              title={contextOpen ? 'Hide settings' : 'Show settings'}
            >
              {contextOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
            </button>
          </div>
        </div>

        {/* Messages */}
        <ScrollArea className="flex-1 px-6 py-4">
          {messagesLoading ? (
            <div className="flex items-center justify-center h-full py-24">
              <Loader2 size={22} className="animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 && !sendMutation.isPending ? (
            <EmptyState onPromptSelect={handlePromptSelect} />
          ) : (
            <div className="flex flex-col gap-5 max-w-3xl mx-auto">
              {messages.map((msg, i) => (
                <ChatMessage
                  key={msg.id}
                  msg={msg}
                  onActionClick={(action) => handleSend(action)}
                />
              ))}

              {/* Typing indicator */}
              {sendMutation.isPending && (
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                    <Bot size={13} className="text-white" />
                  </div>
                  <div className="flex gap-1 px-4 py-3 rounded-2xl bg-secondary/60 border border-border/50 rounded-tl-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </ScrollArea>

        {/* Input area */}
        <div className="border-t border-border p-4 bg-card/10 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3 items-end">
              <div className="flex-1 relative">
                <Input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      handleSend()
                    }
                  }}
                  placeholder="Ask about a strategy, start a backtest, analyze indicators…"
                  className="h-11 pr-4 bg-secondary/40 border-border/60 focus:border-primary/50 rounded-xl text-sm"
                  disabled={sendMutation.isPending}
                />
              </div>
              <Button
                onClick={handleSend}
                disabled={!input.trim() || sendMutation.isPending}
                className="h-11 w-11 rounded-xl flex-shrink-0 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 border-0"
                size="icon"
              >
                {sendMutation.isPending ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <Send size={16} />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground/40 mt-2 text-center">
              Press Enter to send · Shift+Enter for new line · Responses are AI-generated
            </p>
          </div>
        </div>
      </div>

      {/* ── Right Panel: Context & Output ────────────────────────────── */}
      <div
        className={cn(
          'flex-shrink-0 border-l border-border flex flex-col bg-card/30 transition-all duration-200 overflow-hidden',
          contextOpen ? 'w-[280px]' : 'w-0 border-l-0'
        )}
      >
        <div className="flex-1 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-4 space-y-5">

              {/* Context settings */}
              <div className="space-y-3">
                <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                  Context
                </h3>

                <div className="space-y-2.5">
                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground">Sembol</label>
                    <Input
                      value={ticker}
                      onChange={(e) => setTicker(e.target.value.toUpperCase())}
                      className="h-8 text-xs bg-secondary/40 border-border/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground">Periyot</label>
                    <Select
                      value={timeframe}
                      onChange={(e) => setTimeframe(e.target.value as Timeframe)}
                      className="h-8 text-xs"
                    >
                      {TIMEFRAMES.map((tf) => (
                        <option key={tf} value={tf}>
                          {tf}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground">Indicator</label>
                    <Input
                      value={indicatorId}
                      onChange={(e) => setIndicatorId(e.target.value.toLowerCase())}
                      className="h-8 text-xs bg-secondary/40 border-border/50"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] text-muted-foreground">Semboller</label>
                    <SymbolPicker value={selectedSymbols} onChange={setSelectedSymbols} />
                  </div>

                  <label className="flex items-center gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={autoSaveDrafts}
                      onChange={(e) => setAutoSaveDrafts(e.target.checked)}
                      className="rounded"
                    />
                    <span className="text-[11px] text-muted-foreground">AI&apos;ya blueprint paylaş + taslak kaydet</span>
                  </label>
                </div>
              </div>

              {/* Divider */}
              <div className="h-px bg-border/50" />

              {/* Last response info */}
              {latestResponse && (
                <div className="space-y-3">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Last Response
                  </h3>
                  {latestResponse.plan?.intent && (
                    <div className="rounded-lg border border-border/50 bg-secondary/20 px-3 py-2">
                      <div className="text-[10px] text-muted-foreground mb-1">Niyet</div>
                      <div className="text-xs text-foreground font-medium">
                        {latestResponse.plan.intent}
                      </div>
                    </div>
                  )}
                  {latestResponse.errors && latestResponse.errors.length > 0 && (
                    <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2">
                      <div className="text-[10px] text-destructive font-medium mb-1">Hatalar</div>
                      {latestResponse.errors.map((err, i) => (
                        <div key={i} className="text-[11px] text-destructive/80">
                          {err}
                        </div>
                      ))}
                    </div>
                  )}
                  {latestResponse.savedAssets && latestResponse.savedAssets.length > 0 && (
                    <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
                      <div className="text-[10px] text-emerald-400 font-medium mb-1">
                        Kaydedildi
                      </div>
                      <div className="text-[11px] text-emerald-400/80">
                        {latestResponse.savedAssets.length} asset kaydedildi
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Divider */}
              {allAssets.length > 0 && <div className="h-px bg-border/50" />}

              {/* Saved Assets */}
              {allAssets.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                      Saved Assets
                    </h3>
                    <span className="text-[10px] text-muted-foreground/60 bg-secondary/50 px-1.5 py-0.5 rounded-full">
                      {allAssets.length}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {allAssets.slice(0, 10).map((asset) => (
                      <AssetCard key={asset.asset_id} asset={asset} />
                    ))}
                  </div>

                  {/* Counts breakdown */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1">
                    {[
                      {
                        label: 'Strateji',
                        count: assetsQuery.data?.counts?.strategies ?? 0,
                        color: 'text-blue-400',
                      },
                      {
                        label: 'Kural',
                        count: assetsQuery.data?.counts?.rules ?? 0,
                        color: 'text-emerald-400',
                      },
                      {
                        label: 'Indicator',
                        count: assetsQuery.data?.counts?.indicators ?? 0,
                        color: 'text-purple-400',
                      },
                    ].map((item) => (
                      <div
                        key={item.label}
                        className="rounded-lg border border-border/50 bg-secondary/20 px-2 py-1.5 text-center"
                      >
                        <div className={cn('text-sm font-bold', item.color)}>{item.count}</div>
                        <div className="text-[10px] text-muted-foreground">{item.label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty assets state */}
              {allAssets.length === 0 && assetsQuery.isSuccess && (
                <div className="space-y-2">
                  <h3 className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Saved Assets
                  </h3>
                  <p className="text-[11px] text-muted-foreground/50">
                    No saved assets yet. Assets can be saved here once you create strategies with AI.
                  </p>
                </div>
              )}

              {/* New session button */}
              <div className="h-px bg-border/50" />
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  createSessionMutation.mutate()
                }
                disabled={createSessionMutation.isPending}
                className="w-full h-8 text-xs"
              >
                {createSessionMutation.isPending ? (
                  <Loader2 size={12} className="animate-spin mr-1" />
                ) : (
                  <Plus size={12} className="mr-1" />
                )}
                New Session
              </Button>
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}

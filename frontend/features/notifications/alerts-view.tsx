'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  Activity,
  Bell,
  Clock3,
  ExternalLink,
  Info,
  Loader2,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Pause,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
import { Skeleton } from '@/components/ui/skeleton'
import {
  useAlertRules,
  useCreateAlertRule,
  useDeleteAlertRule,
  useSetAlertRuleStatus,
  useUpdateAlertRule,
} from '@/hooks/use-alert-rules'
import {
  useCreateNewsAlertRule,
  useDeleteNewsAlertRule,
  useNewsAlertRules,
  useSetNewsAlertRuleStatus,
  useUpdateNewsAlertRule,
} from '@/hooks/use-news-alert-rules'
import { useToast } from '@/hooks/use-toast'
import { useUserWatchlist } from '@/hooks/use-user-watchlist'
import {
  ALERT_RULE_MAX_FILTERS,
  describeAlertRuleFilters,
  getAlertRuleCadence,
  SUPPORTED_ALERT_TICKERS,
} from '@/lib/notification-rules'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/use-auth-store'
import type {
  AlertRule,
  AlertRuleStatus,
  NewsAlertSentiment,
  WatchlistNewsAlertRule,
} from '@/types'
import type {
  FilterLogic,
  ScreenerFilter,
  ScreenerTimeframe,
} from '@/types/screener'
import { FilterBuilder } from '@/features/screener/filter-panel/filter-builder'
import { SCREENER_TIMEFRAMES } from '@/types/screener'

export interface AlertsViewProps {
  isWidget?: boolean
}

interface AlertRulesPanelProps {
  embedded?: boolean
}

const NEWS_SENTIMENT_OPTIONS: Array<{
  value: NewsAlertSentiment
  label: string
  description: string
}> = [
  {
    value: 'OLUMLU',
    label: 'Positive',
    description: 'Optimistic coverage',
  },
  {
    value: 'OLUMSUZ',
    label: 'Negative',
    description: 'Risk-heavy headlines',
  },
  {
    value: 'NOTR',
    label: 'Neutral',
    description: 'Mixed or neutral items',
  },
]

const DEFAULT_NEWS_SENTIMENTS: NewsAlertSentiment[] = [
  'OLUMLU',
  'OLUMSUZ',
  'NOTR',
]

interface AlertRuleFormState {
  ticker: string
  timeframe: ScreenerTimeframe
  logic: FilterLogic
  filters: ScreenerFilter[]
}

const DEFAULT_RULE_FORM: AlertRuleFormState = {
  ticker: 'THYAO',
  timeframe: '1d',
  logic: 'AND',
  filters: [
    {
      type: 'price',
      op: 'gt',
      value: 10,
    },
  ],
}

function formatDateTime(value: string | null): string {
  if (!value) return 'Never'

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return 'Never'
  }

  return parsed.toLocaleString('tr-TR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function buildFormFromRule(rule: AlertRule): AlertRuleFormState {
  return {
    ticker: rule.ticker,
    timeframe: rule.timeframe,
    logic: rule.logic,
    filters: rule.filters,
  }
}

function formatSentiments(sentiments: NewsAlertSentiment[]): string {
  return sentiments
    .map(
      (sentiment) =>
        NEWS_SENTIMENT_OPTIONS.find((option) => option.value === sentiment)
          ?.label ?? sentiment
    )
    .join(', ')
}

function areSentimentsEqual(
  left: NewsAlertSentiment[],
  right: NewsAlertSentiment[]
): boolean {
  if (left.length !== right.length) return false
  return left.every((sentiment, index) => sentiment === right[index])
}

function describeWatchlistCoverage(tickers: string[]): string {
  if (tickers.length === 0) {
    return 'No watchlist tickers yet. This rule starts matching after you add symbols.'
  }

  if (tickers.length <= 4) {
    return tickers.join(', ')
  }

  return `${tickers.slice(0, 4).join(', ')} +${tickers.length - 4} more`
}

type WidgetFilter = 'all' | 'active' | 'paused' | 'triggered'

type DeleteTarget =
  | {
      type: 'market'
      id: string
      label: string
    }
  | {
      type: 'news'
      id: string
      label: string
    }

const WIDGET_FILTERS: Array<{ value: WidgetFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'triggered', label: 'Triggered 24h' },
]

const RECENT_TRIGGER_WINDOW_HOURS = 24

function isWithinLastHours(value: string | null, hours: number): boolean {
  if (!value) return false

  const timestamp = new Date(value).getTime()
  if (Number.isNaN(timestamp)) return false

  return Date.now() - timestamp <= hours * 60 * 60 * 1000
}

function getStatusBadgeClass(status: AlertRuleStatus): string {
  return status === 'active'
    ? 'border-primary/30 text-primary'
    : 'border-muted text-muted-foreground'
}

function getSentimentLabel(sentiment: NewsAlertSentiment): string {
  return (
    NEWS_SENTIMENT_OPTIONS.find((option) => option.value === sentiment)?.label ??
    sentiment
  )
}

function normalizeSearch(value: string): string {
  return value.trim().toLowerCase()
}

function ruleMatchesSearch(rule: AlertRule, query: string): boolean {
  if (!query) return true

  const cadence = getAlertRuleCadence(rule.filters, rule.timeframe)
  const haystack = [
    rule.ticker,
    rule.status,
    rule.timeframe,
    cadence.label,
    describeAlertRuleFilters(rule.filters, rule.logic),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function newsRuleMatchesSearch(
  rule: WatchlistNewsAlertRule,
  watchlistTickers: string[],
  query: string
): boolean {
  if (!query) return true

  const sentimentText = rule.sentiments
    .flatMap((sentiment) => [sentiment, getSentimentLabel(sentiment)])
    .join(' ')
  const haystack = [
    'watchlist news',
    'smart batching',
    rule.status,
    sentimentText,
    watchlistTickers.join(' '),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function ruleMatchesFilter(
  rule: Pick<AlertRule | WatchlistNewsAlertRule, 'status' | 'lastTriggeredAt'>,
  filter: WidgetFilter
): boolean {
  if (filter === 'all') return true
  if (filter === 'triggered') {
    return isWithinLastHours(
      rule.lastTriggeredAt,
      RECENT_TRIGGER_WINDOW_HOURS
    )
  }

  return rule.status === filter
}

function getRuleUpdatedTime(rule: AlertRule): number {
  const triggeredAt = rule.lastTriggeredAt
    ? new Date(rule.lastTriggeredAt).getTime()
    : 0
  const updatedAt = new Date(rule.updatedAt).getTime()

  return Math.max(
    Number.isNaN(triggeredAt) ? 0 : triggeredAt,
    Number.isNaN(updatedAt) ? 0 : updatedAt
  )
}

function sortRulesForWidget(rules: AlertRule[]): AlertRule[] {
  return [...rules].sort((left, right) => {
    const leftRecent = isWithinLastHours(
      left.lastTriggeredAt,
      RECENT_TRIGGER_WINDOW_HOURS
    )
    const rightRecent = isWithinLastHours(
      right.lastTriggeredAt,
      RECENT_TRIGGER_WINDOW_HOURS
    )

    if (leftRecent !== rightRecent) {
      return leftRecent ? -1 : 1
    }

    if (left.status !== right.status) {
      return left.status === 'active' ? -1 : 1
    }

    return getRuleUpdatedTime(right) - getRuleUpdatedTime(left)
  })
}

function AlertsPreview({
  rules,
  newsRule,
  watchlistTickers,
  isLoading,
  isError,
  onRetry,
}: {
  rules: AlertRule[]
  newsRule: WatchlistNewsAlertRule | null
  watchlistTickers: string[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
}) {
  const { toast } = useToast()
  const setRuleStatusMutation = useSetAlertRuleStatus()
  const deleteRuleMutation = useDeleteAlertRule()
  const setNewsRuleStatusMutation = useSetNewsAlertRuleStatus()
  const deleteNewsRuleMutation = useDeleteNewsAlertRule()
  const [filter, setFilter] = useState<WidgetFilter>('all')
  const [search, setSearch] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null)
  const [busyTarget, setBusyTarget] = useState<string | null>(null)

  const normalizedSearch = normalizeSearch(search)
  const sortedRules = useMemo(() => sortRulesForWidget(rules), [rules])
  const activeMarketRules = rules.filter((rule) => rule.status === 'active')
  const pausedMarketRules = rules.filter((rule) => rule.status === 'paused')
  const activeNewsRule = newsRule?.status === 'active' ? newsRule : null
  const pausedNewsRule = newsRule?.status === 'paused' ? newsRule : null
  const activeCount = activeMarketRules.length + (activeNewsRule ? 1 : 0)
  const pausedCount = pausedMarketRules.length + (pausedNewsRule ? 1 : 0)
  const recentCount =
    rules.filter((rule) =>
      isWithinLastHours(rule.lastTriggeredAt, RECENT_TRIGGER_WINDOW_HOURS)
    ).length +
    (newsRule &&
    isWithinLastHours(newsRule.lastTriggeredAt, RECENT_TRIGGER_WINDOW_HOURS)
      ? 1
      : 0)
  const totalCount = rules.length + (newsRule ? 1 : 0)
  const filteredRules = sortedRules.filter(
    (rule) =>
      ruleMatchesFilter(rule, filter) &&
      ruleMatchesSearch(rule, normalizedSearch)
  )
  const visibleNewsRule =
    newsRule &&
    ruleMatchesFilter(newsRule, filter) &&
    newsRuleMatchesSearch(newsRule, watchlistTickers, normalizedSearch)
      ? newsRule
      : null
  const hasVisibleRules = filteredRules.length > 0 || Boolean(visibleNewsRule)
  const isBusy =
    Boolean(busyTarget) ||
    setRuleStatusMutation.isPending ||
    deleteRuleMutation.isPending ||
    setNewsRuleStatusMutation.isPending ||
    deleteNewsRuleMutation.isPending
  const filterCounts: Record<WidgetFilter, number> = {
    all: totalCount,
    active: activeCount,
    paused: pausedCount,
    triggered: recentCount,
  }

  const handleSetMarketStatus = async (
    rule: AlertRule,
    status: AlertRuleStatus
  ) => {
    setBusyTarget(`market:${rule.id}`)

    try {
      await setRuleStatusMutation.mutateAsync({ ruleId: rule.id, status })
      toast({
        variant: 'success',
        description: `${rule.ticker} rule ${status === 'active' ? 'resumed' : 'paused'}.`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        description:
          error instanceof Error
            ? error.message
            : 'Rule status could not be updated.',
      })
    } finally {
      setBusyTarget(null)
    }
  }

  const handleSetNewsStatus = async (
    rule: WatchlistNewsAlertRule,
    status: AlertRuleStatus
  ) => {
    setBusyTarget(`news:${rule.id}`)

    try {
      await setNewsRuleStatusMutation.mutateAsync({ ruleId: rule.id, status })
      toast({
        variant: 'success',
        description: `Watchlist News rule ${status === 'active' ? 'resumed' : 'paused'}.`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        description:
          error instanceof Error
            ? error.message
            : 'News rule status could not be updated.',
      })
    } finally {
      setBusyTarget(null)
    }
  }

  const handleBulkStatus = async (status: AlertRuleStatus) => {
    const marketTargets = rules.filter((rule) => rule.status !== status)
    const shouldUpdateNewsRule = newsRule && newsRule.status !== status
    const targetCount = marketTargets.length + (shouldUpdateNewsRule ? 1 : 0)

    if (targetCount === 0) return

    setBusyTarget('bulk')

    try {
      for (const rule of marketTargets) {
        await setRuleStatusMutation.mutateAsync({ ruleId: rule.id, status })
      }

      if (shouldUpdateNewsRule) {
        await setNewsRuleStatusMutation.mutateAsync({
          ruleId: newsRule.id,
          status,
        })
      }

      toast({
        variant: 'success',
        description: `${targetCount} rule${targetCount === 1 ? '' : 's'} ${
          status === 'active' ? 'resumed' : 'paused'
        }.`,
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        description:
          error instanceof Error
            ? error.message
            : 'Rule statuses could not be updated.',
      })
    } finally {
      setBusyTarget(null)
    }
  }

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return

    setBusyTarget(`delete:${deleteTarget.type}:${deleteTarget.id}`)

    try {
      if (deleteTarget.type === 'market') {
        await deleteRuleMutation.mutateAsync(deleteTarget.id)
      } else {
        await deleteNewsRuleMutation.mutateAsync(deleteTarget.id)
      }

      toast({
        variant: 'success',
        description: `${deleteTarget.label} deleted.`,
      })
      setDeleteTarget(null)
    } catch (error) {
      toast({
        variant: 'destructive',
        description:
          error instanceof Error ? error.message : 'Rule could not be deleted.',
      })
    } finally {
      setBusyTarget(null)
    }
  }

  return (
    <Dialog open={Boolean(deleteTarget)} onOpenChange={(open) => !open && setDeleteTarget(null)}>
      <div className="bg-background flex h-full flex-col">
        <div className="border-border bg-background sticky top-0 z-10 border-b px-4 pt-4 pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Bell size={16} aria-hidden="true" />
                Alert Rules
              </p>
              <p className="text-muted-foreground text-[10px]">
                {activeCount} active, {pausedCount} paused
              </p>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
              <Link href="/alerts">
                Open
                <ExternalLink size={12} aria-hidden="true" />
              </Link>
            </Button>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2">
            <div className="border-border bg-card rounded-lg border p-2">
              <p className="text-muted-foreground text-[10px]">Active</p>
              <p className="text-sm font-semibold">{activeCount}</p>
            </div>
            <div className="border-border bg-card rounded-lg border p-2">
              <p className="text-muted-foreground text-[10px]">Paused</p>
              <p className="text-sm font-semibold">{pausedCount}</p>
            </div>
            <div className="border-border bg-card rounded-lg border p-2">
              <p className="text-muted-foreground text-[10px]">24h</p>
              <p className="text-sm font-semibold">{recentCount}</p>
            </div>
          </div>

          <div className="relative mt-3">
            <Search
              className="text-muted-foreground absolute top-1/2 left-3 h-3.5 w-3.5 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search rules"
              className="h-8 pl-8 text-xs"
              disabled={isLoading}
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {WIDGET_FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setFilter(item.value)}
                className={cn(
                  'focus-visible:ring-primary rounded-md border px-2 py-1 text-[10px] transition-colors focus-visible:ring-2 focus-visible:outline-none',
                  filter === item.value
                    ? 'border-primary/40 bg-primary/10 text-primary'
                    : 'border-border bg-card text-muted-foreground hover:text-foreground'
                )}
              >
                {item.label} {filterCounts[item.value]}
              </button>
            ))}
          </div>

          {totalCount > 0 ? (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleBulkStatus('paused')}
                disabled={isBusy || activeCount === 0}
              >
                {busyTarget === 'bulk' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Pause className="h-3.5 w-3.5" />
                )}
                Pause all
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => handleBulkStatus('active')}
                disabled={isBusy || pausedCount === 0}
              >
                {busyTarget === 'bulk' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Resume all
              </Button>
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-auto px-2 py-2">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <div
                  key={index}
                  className="border-border bg-card rounded-lg border p-3"
                >
                  <div className="flex items-center justify-between">
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-6 w-16" />
                  </div>
                  <Skeleton className="mt-3 h-3 w-full" />
                  <Skeleton className="mt-2 h-3 w-3/4" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-3 text-xs">
              <p className="font-medium">Alert rules could not be loaded.</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-8 text-xs"
                onClick={onRetry}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </Button>
            </div>
          ) : totalCount === 0 ? (
            <div className="border-border text-muted-foreground rounded-xl border border-dashed p-4 text-center text-xs">
              <p className="font-medium text-foreground">No rules yet</p>
              <p className="mt-1">
                Create market rules on the full alerts page. Watchlist News can
                be enabled from notification rules.
              </p>
              <Button
                asChild
                variant="outline"
                size="sm"
                className="mt-3 h-8 text-xs"
              >
                <Link href="/alerts">Create rule</Link>
              </Button>
            </div>
          ) : !hasVisibleRules ? (
            <div className="border-border text-muted-foreground rounded-xl border border-dashed p-4 text-center text-xs">
              <p>No rules match this view.</p>
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 h-8 text-xs"
                onClick={() => {
                  setFilter('all')
                  setSearch('')
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {visibleNewsRule ? (
                <div className="border-border bg-card rounded-lg border p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-semibold">
                          Watchlist News
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            'text-[10px]',
                            getStatusBadgeClass(visibleNewsRule.status)
                          )}
                        >
                          {visibleNewsRule.status}
                        </Badge>
                        {isWithinLastHours(
                          visibleNewsRule.lastTriggeredAt,
                          RECENT_TRIGGER_WINDOW_HOURS
                        ) ? (
                          <Badge variant="secondary" className="text-[10px]">
                            Triggered
                          </Badge>
                        ) : null}
                      </div>
                      <p className="text-muted-foreground mt-1 text-xs">
                        Smart batching
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-1">
                      <Button
                        variant="outline"
                        size="xs"
                        className="h-7 text-[10px]"
                        onClick={() =>
                          handleSetNewsStatus(
                            visibleNewsRule,
                            visibleNewsRule.status === 'active'
                              ? 'paused'
                              : 'active'
                          )
                        }
                        disabled={isBusy}
                      >
                        {busyTarget === `news:${visibleNewsRule.id}` ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : visibleNewsRule.status === 'active' ? (
                          <Pause className="h-3 w-3" />
                        ) : (
                          <Play className="h-3 w-3" />
                        )}
                        {visibleNewsRule.status === 'active'
                          ? 'Pause'
                          : 'Resume'}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            disabled={isBusy}
                            aria-label="Watchlist News actions"
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                          <DropdownMenuItem asChild>
                            <Link href="/notifications?tab=rules">
                              <ExternalLink className="h-4 w-4" />
                              Manage
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            onSelect={() =>
                              setDeleteTarget({
                                type: 'news',
                                id: visibleNewsRule.id,
                                label: 'Watchlist News rule',
                              })
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1">
                    {visibleNewsRule.sentiments.map((sentiment) => (
                      <Badge
                        key={sentiment}
                        variant="secondary"
                        className="text-[10px]"
                        title={sentiment}
                      >
                        {getSentimentLabel(sentiment)}
                      </Badge>
                    ))}
                  </div>

                  <p className="text-muted-foreground mt-3 line-clamp-2 text-xs">
                    {describeWatchlistCoverage(watchlistTickers)}
                  </p>

                  <div className="text-muted-foreground mt-3 grid gap-1.5 text-[10px]">
                    <span className="flex items-center gap-1.5">
                      <Clock3 className="h-3 w-3" />
                      Last check: {formatDateTime(visibleNewsRule.lastCheckedAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Activity className="h-3 w-3" />
                      Last trigger:{' '}
                      {formatDateTime(visibleNewsRule.lastTriggeredAt)}
                    </span>
                  </div>
                </div>
              ) : null}

              {filteredRules.map((rule) => {
                const cadence = getAlertRuleCadence(rule.filters, rule.timeframe)
                const targetKey = `market:${rule.id}`

                return (
                  <div
                    key={rule.id}
                    className="border-border bg-card rounded-lg border p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="truncate text-sm font-semibold">
                            {rule.ticker}
                          </span>
                          <Badge
                            variant="outline"
                            className={cn('text-[10px]', getStatusBadgeClass(rule.status))}
                          >
                            {rule.status}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px]">
                            {rule.timeframe}
                          </Badge>
                          {isWithinLastHours(
                            rule.lastTriggeredAt,
                            RECENT_TRIGGER_WINDOW_HOURS
                          ) ? (
                            <Badge variant="secondary" className="text-[10px]">
                              Triggered
                            </Badge>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-1">
                        <Button
                          variant="outline"
                          size="xs"
                          className="h-7 text-[10px]"
                          onClick={() =>
                            handleSetMarketStatus(
                              rule,
                              rule.status === 'active' ? 'paused' : 'active'
                            )
                          }
                          disabled={isBusy}
                        >
                          {busyTarget === targetKey ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : rule.status === 'active' ? (
                            <Pause className="h-3 w-3" />
                          ) : (
                            <Play className="h-3 w-3" />
                          )}
                          {rule.status === 'active' ? 'Pause' : 'Resume'}
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              disabled={isBusy}
                              aria-label={`${rule.ticker} rule actions`}
                            >
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-40">
                            <DropdownMenuItem asChild>
                              <Link href={`/alerts#rule-${rule.id}`}>
                                <Pencil className="h-4 w-4" />
                                Open/Edit
                              </Link>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onSelect={() =>
                                setDeleteTarget({
                                  type: 'market',
                                  id: rule.id,
                                  label: `${rule.ticker} rule`,
                                })
                              }
                            >
                              <Trash2 className="h-4 w-4" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    <p className="text-muted-foreground mt-2 line-clamp-2 text-xs">
                      {describeAlertRuleFilters(rule.filters, rule.logic)}
                    </p>

                    <div className="text-muted-foreground mt-3 grid gap-1.5 text-[10px]">
                      <span className="flex items-center gap-1.5">
                        <Clock3 className="h-3 w-3" />
                        Cadence: {cadence.label}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Activity className="h-3 w-3" />
                        Last trigger: {formatDateTime(rule.lastTriggeredAt)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Clock3 className="h-3 w-3" />
                        Next evaluation: {formatDateTime(rule.nextEvaluationAt)}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete alert rule</DialogTitle>
          <DialogDescription>
            {deleteTarget
              ? `${deleteTarget.label} will be removed. This cannot be undone.`
              : 'This rule will be removed. This cannot be undone.'}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost" disabled={isBusy}>
              Cancel
            </Button>
          </DialogClose>
          <Button
            variant="destructive"
            onClick={handleConfirmDelete}
            disabled={isBusy}
          >
            {busyTarget?.startsWith('delete:') ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function AlertRulesPanel({ embedded = false }: AlertRulesPanelProps) {
  const { data: rules = [], isLoading, isError } = useAlertRules()
  const {
    data: newsRules = [],
    isLoading: isLoadingNewsRules,
    isError: isNewsRulesError,
  } = useNewsAlertRules()
  const { data: watchlist } = useUserWatchlist()
  const createRuleMutation = useCreateAlertRule()
  const updateRuleMutation = useUpdateAlertRule()
  const deleteRuleMutation = useDeleteAlertRule()
  const setRuleStatusMutation = useSetAlertRuleStatus()
  const createNewsRuleMutation = useCreateNewsAlertRule()
  const updateNewsRuleMutation = useUpdateNewsAlertRule()
  const deleteNewsRuleMutation = useDeleteNewsAlertRule()
  const setNewsRuleStatusMutation = useSetNewsAlertRuleStatus()

  const [form, setForm] = useState<AlertRuleFormState>(DEFAULT_RULE_FORM)
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)
  const [newsSentimentsDraft, setNewsSentimentsDraft] = useState<
    NewsAlertSentiment[] | null
  >(null)
  const [newsFeedback, setNewsFeedback] = useState<string | null>(null)

  const isBusy =
    createRuleMutation.isPending ||
    updateRuleMutation.isPending ||
    deleteRuleMutation.isPending ||
    setRuleStatusMutation.isPending
  const isNewsBusy =
    createNewsRuleMutation.isPending ||
    updateNewsRuleMutation.isPending ||
    deleteNewsRuleMutation.isPending ||
    setNewsRuleStatusMutation.isPending
  const watchlistTickers = watchlist?.tickers ?? []
  const currentNewsRule = newsRules[0] ?? null
  const newsSentiments =
    newsSentimentsDraft ??
    currentNewsRule?.sentiments ??
    DEFAULT_NEWS_SENTIMENTS
  const hasNewsSentimentChanges = currentNewsRule
    ? !areSentimentsEqual(newsSentiments, currentNewsRule.sentiments)
    : true

  const activeRules = useMemo(
    () => rules.filter((rule) => rule.status === 'active'),
    [rules]
  )
  const activeNewsRules = useMemo(
    () => newsRules.filter((rule) => rule.status === 'active'),
    [newsRules]
  )

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.startsWith('#rule-')) return

    window.requestAnimationFrame(() => {
      document.getElementById(hash.slice(1))?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    })
  }, [rules.length])

  const handleSaveRule = async () => {
    setFeedback(null)

    try {
      if (editingRuleId) {
        await updateRuleMutation.mutateAsync({
          ruleId: editingRuleId,
          payload: form,
        })
      } else {
        await createRuleMutation.mutateAsync(form)
      }

      setForm(DEFAULT_RULE_FORM)
      setEditingRuleId(null)
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Rule could not be saved.'
      )
    }
  }

  const handleStartEdit = (rule: AlertRule) => {
    setFeedback(null)
    setEditingRuleId(rule.id)
    setForm(buildFormFromRule(rule))
    document
      .getElementById(`rule-${rule.id}`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleCancelEdit = () => {
    setFeedback(null)
    setEditingRuleId(null)
    setForm(DEFAULT_RULE_FORM)
  }

  const handleDeleteRule = async (ruleId: string) => {
    setFeedback(null)
    try {
      await deleteRuleMutation.mutateAsync(ruleId)
      if (editingRuleId === ruleId) {
        handleCancelEdit()
      }
    } catch (error) {
      setFeedback(
        error instanceof Error ? error.message : 'Rule could not be deleted.'
      )
    }
  }

  const handleToggleRuleStatus = async (rule: AlertRule) => {
    setFeedback(null)
    try {
      await setRuleStatusMutation.mutateAsync({
        ruleId: rule.id,
        status: rule.status === 'active' ? 'paused' : 'active',
      })
    } catch (error) {
      setFeedback(
        error instanceof Error
          ? error.message
          : 'Rule status could not be updated.'
      )
    }
  }

  const handleToggleNewsSentiment = (sentiment: NewsAlertSentiment) => {
    setNewsFeedback(null)
    setNewsSentimentsDraft((currentDraft) => {
      const current = currentDraft ?? newsSentiments

      if (current.includes(sentiment)) {
        if (current.length === 1) {
          setNewsFeedback('Select at least one sentiment.')
          return current
        }

        return current.filter((item) => item !== sentiment)
      }

      return [...current, sentiment]
    })
  }

  const resetNewsDraft = () => {
    setNewsSentimentsDraft(null)
  }

  const handleSaveNewsRule = async () => {
    setNewsFeedback(null)

    if (newsSentiments.length === 0) {
      setNewsFeedback('Select at least one sentiment.')
      return
    }

    try {
      if (currentNewsRule) {
        await updateNewsRuleMutation.mutateAsync({
          ruleId: currentNewsRule.id,
          payload: { sentiments: newsSentiments },
        })
        resetNewsDraft()
        return
      }

      await createNewsRuleMutation.mutateAsync({
        sentiments: newsSentiments,
      })
      resetNewsDraft()
    } catch (error) {
      setNewsFeedback(
        error instanceof Error ? error.message : 'News rule could not be saved.'
      )
    }
  }

  const handleDeleteNewsRule = async () => {
    if (!currentNewsRule) {
      return
    }

    setNewsFeedback(null)
    try {
      await deleteNewsRuleMutation.mutateAsync(currentNewsRule.id)
      resetNewsDraft()
    } catch (error) {
      setNewsFeedback(
        error instanceof Error
          ? error.message
          : 'News rule could not be deleted.'
      )
    }
  }

  const handleToggleNewsRuleStatus = async () => {
    if (!currentNewsRule) {
      return
    }

    setNewsFeedback(null)
    try {
      await setNewsRuleStatusMutation.mutateAsync({
        ruleId: currentNewsRule.id,
        status: currentNewsRule.status === 'active' ? 'paused' : 'active',
      })
      resetNewsDraft()
    } catch (error) {
      setNewsFeedback(
        error instanceof Error
          ? error.message
          : 'News rule status could not be updated.'
      )
    }
  }

  return (
    <div
      className={cn(
        'flex w-full flex-col gap-6',
        embedded ? '' : 'mx-auto max-w-6xl p-6'
      )}
    >
      {!embedded ? (
        <div className="flex flex-col gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Alert Rules</h1>
          <p className="text-muted-foreground max-w-2xl text-sm">
            Manage market rules and the single watchlist news rule.
          </p>
        </div>
      ) : null}

      <Card className="border-border bg-card p-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Watchlist News Rule</h2>
              <p className="text-muted-foreground mt-1 text-sm">
                Uses your current watchlist and the selected sentiment labels.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {watchlistTickers.length} watchlist tickers
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {activeNewsRules.length} active
              </Badge>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.3fr_1fr]">
            <div className="border-border bg-background/40 rounded-lg border p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-sm font-semibold">Sentiment Filters</h3>
                  <p className="text-muted-foreground mt-1 text-xs">
                    Changes are saved only when you press Save.
                  </p>
                </div>
                <Badge variant="outline" className="w-fit text-xs">
                  Smart batching
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {NEWS_SENTIMENT_OPTIONS.map((option) => {
                  const isSelected = newsSentiments.includes(option.value)
                  const isLastSelected =
                    isSelected && newsSentiments.length === 1

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToggleNewsSentiment(option.value)}
                      disabled={isNewsBusy}
                      aria-pressed={isSelected}
                      title={
                        isLastSelected
                          ? 'At least one sentiment must stay selected'
                          : option.label
                      }
                      className={cn(
                        'focus-visible:ring-primary rounded-lg border p-4 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50',
                        isSelected
                          ? 'border-primary/40 bg-primary/10'
                          : 'border-border bg-card hover:border-primary/20'
                      )}
                    >
                      <p className="text-sm font-semibold">{option.label}</p>
                      <p className="text-muted-foreground mt-1 text-xs">
                        {option.description}
                      </p>
                    </button>
                  )
                })}
              </div>

              <div className="border-border bg-card text-muted-foreground mt-4 flex gap-2 rounded-lg border p-3 text-xs">
                <Info className="text-primary mt-0.5 h-4 w-4 flex-shrink-0" />
                <span>
                  Watchlist news is grouped about every 10 minutes before a
                  notification is delivered.
                </span>
              </div>

              {newsFeedback ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-lg border p-3 text-sm"
                >
                  {newsFeedback}
                </div>
              ) : null}

              {watchlistTickers.length === 0 ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="border-chart-4/30 bg-chart-4/10 text-chart-4 mt-4 rounded-lg border p-3 text-sm"
                >
                  This rule can be active now, but it starts matching only after
                  you add symbols to the watchlist.
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="h-11 sm:h-9"
                    onClick={handleSaveNewsRule}
                    disabled={
                      isNewsBusy ||
                      newsSentiments.length === 0 ||
                      (Boolean(currentNewsRule) && !hasNewsSentimentChanges)
                    }
                  >
                    {isNewsBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : currentNewsRule ? (
                      'Save News Rule'
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create News Rule
                      </>
                    )}
                  </Button>
                  {newsSentimentsDraft ? (
                    <Button
                      variant="ghost"
                      className="h-11 sm:h-9"
                      onClick={resetNewsDraft}
                      disabled={isNewsBusy}
                    >
                      Cancel
                    </Button>
                  ) : null}
                  {currentNewsRule ? (
                    <Button
                      variant="outline"
                      className="h-11 sm:h-9"
                      onClick={handleToggleNewsRuleStatus}
                      disabled={isNewsBusy}
                    >
                      {currentNewsRule.status === 'active' ? (
                        <>
                          <Pause className="h-4 w-4" />
                          Pause
                        </>
                      ) : (
                        <>
                          <Play className="h-4 w-4" />
                          Resume
                        </>
                      )}
                    </Button>
                  ) : null}
                  {currentNewsRule ? (
                    <Button
                      variant="outline"
                      className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive h-11 sm:h-9"
                      onClick={handleDeleteNewsRule}
                      disabled={isNewsBusy}
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="border-border bg-background/40 rounded-lg border p-4">
              <h3 className="text-sm font-semibold">Rule Summary</h3>
              {isLoadingNewsRules ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="text-primary h-5 w-5 animate-spin" />
                </div>
              ) : isNewsRulesError ? (
                <div
                  role="alert"
                  aria-live="assertive"
                  className="border-destructive/30 bg-destructive/10 text-destructive mt-4 rounded-lg border p-3 text-sm"
                >
                  News rule could not be loaded.
                </div>
              ) : currentNewsRule ? (
                <div className="mt-4 space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Status</span>
                    <Badge
                      variant="outline"
                      className={cn(
                        currentNewsRule.status === 'active'
                          ? 'border-primary/30 text-primary'
                          : 'border-muted text-muted-foreground'
                      )}
                    >
                      {currentNewsRule.status}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Sentiments</span>
                    <span>{formatSentiments(currentNewsRule.sentiments)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Watchlist</span>
                    <span>{watchlistTickers.length} tickers</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Last check</span>
                    <span>{formatDateTime(currentNewsRule.lastCheckedAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-muted-foreground">Last trigger</span>
                    <span>
                      {formatDateTime(currentNewsRule.lastTriggeredAt)}
                    </span>
                  </div>
                  <div className="border-border bg-card text-muted-foreground rounded-lg border p-3 text-xs">
                    {describeWatchlistCoverage(watchlistTickers)}
                  </div>
                  <Button
                    asChild
                    variant="outline"
                    size="sm"
                    className="h-9 w-full"
                  >
                    <Link href="/watchlist">Manage watchlist</Link>
                  </Button>
                </div>
              ) : (
                <div className="border-border text-muted-foreground mt-4 rounded-lg border border-dashed p-4 text-sm">
                  No watchlist news rule created yet.
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-border bg-card p-5">
        <div className="flex flex-col gap-4">
          <div>
            <h2 className="text-lg font-semibold">Market Rules</h2>
            <p className="text-muted-foreground mt-1 text-sm">
              Create price and indicator conditions for one ticker at a time.
            </p>
          </div>

          <div className="flex flex-col gap-2 md:flex-row md:items-end">
            <label className="flex flex-1 flex-col gap-2">
              <span className="text-sm font-medium">Ticker</span>
              <Input
                list="alert-rule-tickers"
                value={form.ticker}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    ticker: event.target.value.toUpperCase(),
                  }))
                }
                disabled={isBusy}
                placeholder="THYAO"
              />
              <datalist id="alert-rule-tickers">
                {SUPPORTED_ALERT_TICKERS.map((ticker) => (
                  <option key={ticker} value={ticker} />
                ))}
              </datalist>
            </label>

            <label className="flex w-full flex-col gap-2 md:w-44">
              <span className="text-sm font-medium">Timeframe</span>
              <Select
                value={form.timeframe}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    timeframe: event.target.value as ScreenerTimeframe,
                  }))
                }
                disabled={isBusy}
              >
                {SCREENER_TIMEFRAMES.map((timeframe) => (
                  <option key={timeframe.value} value={timeframe.value}>
                    {timeframe.label}
                  </option>
                ))}
              </Select>
            </label>

            <label className="flex w-full flex-col gap-2 md:w-36">
              <span className="text-sm font-medium">Logic</span>
              <Select
                value={form.logic}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    logic: event.target.value as FilterLogic,
                  }))
                }
                disabled={isBusy}
              >
                <option value="AND">AND</option>
                <option value="OR">OR</option>
              </Select>
            </label>
          </div>

          <div className="border-border bg-background/40 rounded-lg border p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold">Conditions</h2>
              </div>
              <Badge variant="outline" className="text-xs">
                {form.filters.length}/{ALERT_RULE_MAX_FILTERS}
              </Badge>
            </div>
            <FilterBuilder
              filters={form.filters}
              onChange={(filters) =>
                setForm((current) => ({
                  ...current,
                  filters,
                }))
              }
            />
          </div>

          {feedback ? (
            <div
              role="alert"
              aria-live="assertive"
              className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-3 text-sm"
            >
              {feedback}
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {editingRuleId ? (
                <Button
                  variant="ghost"
                  className="h-11 sm:h-9"
                  onClick={handleCancelEdit}
                  disabled={isBusy}
                >
                  Cancel
                </Button>
              ) : null}
              <Button
                className="h-11 sm:h-9"
                onClick={handleSaveRule}
                disabled={isBusy || form.filters.length === 0}
              >
                {isBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editingRuleId ? (
                  'Update Rule'
                ) : (
                  <>
                    <Plus className="h-4 w-4" />
                    Create Rule
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <Card className="border-border bg-card p-5">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Saved Rules</h2>
            <p className="text-muted-foreground text-sm">
              {activeRules.length} active of {rules.length} total rules
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
          </div>
        ) : isError ? (
          <div
            role="alert"
            aria-live="assertive"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border p-4 text-sm"
          >
            Alert rules could not be loaded.
          </div>
        ) : rules.length === 0 ? (
          <div className="border-border text-muted-foreground rounded-lg border border-dashed p-8 text-center text-sm">
            No alert rules created yet.
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => {
              const cadence = getAlertRuleCadence(rule.filters, rule.timeframe)

              return (
                <div
                  key={rule.id}
                  id={`rule-${rule.id}`}
                  className="border-border bg-background/40 scroll-mt-24 rounded-lg border p-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-lg font-semibold">
                          {rule.ticker}
                        </span>
                        <Badge
                          variant="outline"
                          className={cn(
                            rule.status === 'active'
                              ? 'border-primary/30 text-primary'
                              : 'border-muted text-muted-foreground'
                          )}
                        >
                          {rule.status}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {rule.timeframe}
                        </Badge>
                      </div>

                      <p className="text-foreground mt-2 text-sm">
                        {describeAlertRuleFilters(rule.filters, rule.logic)}
                      </p>

                      <div className="text-muted-foreground mt-3 flex flex-wrap gap-4 text-xs">
                        <span>Cadence: {cadence.label}</span>
                        <span>
                          Last trigger: {formatDateTime(rule.lastTriggeredAt)}
                        </span>
                        <span>
                          Next evaluation:{' '}
                          {formatDateTime(rule.nextEvaluationAt)}
                        </span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-11 sm:h-8"
                        onClick={() => handleStartEdit(rule)}
                        disabled={isBusy}
                      >
                        <Pencil className="h-4 w-4" />
                        Edit
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-11 sm:h-8"
                        onClick={() => handleToggleRuleStatus(rule)}
                        disabled={isBusy}
                      >
                        {rule.status === 'active' ? (
                          <>
                            <Pause className="h-4 w-4" />
                            Pause
                          </>
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Resume
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive h-11 sm:h-8"
                        onClick={() => handleDeleteRule(rule.id)}
                        disabled={isBusy}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Card>
    </div>
  )
}

function AlertsWidgetPreview() {
  const alertRulesQuery = useAlertRules()
  const newsRulesQuery = useNewsAlertRules()
  const { data: watchlist } = useUserWatchlist()

  return (
    <AlertsPreview
      rules={alertRulesQuery.data ?? []}
      newsRule={newsRulesQuery.data?.[0] ?? null}
      watchlistTickers={watchlist?.tickers ?? []}
      isLoading={alertRulesQuery.isLoading || newsRulesQuery.isLoading}
      isError={alertRulesQuery.isError || newsRulesQuery.isError}
      onRetry={() => {
        void alertRulesQuery.refetch()
        void newsRulesQuery.refetch()
      }}
    />
  )
}

export function AlertsView({ isWidget = false }: AlertsViewProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

  if (!isAuthenticated) {
    return (
      <div
        className={cn(
          'flex h-full items-center justify-center',
          !isWidget && 'p-6'
        )}
      >
        <Card className="border-border bg-card max-w-md p-6 text-center">
          <h1 className="text-lg font-semibold">Sign in required</h1>
          <p className="text-muted-foreground mt-2 text-sm">
            Alert rules are available after sign-in.
          </p>
        </Card>
      </div>
    )
  }

  if (isWidget) {
    return <AlertsWidgetPreview />
  }

  return <AlertRulesPanel />
}

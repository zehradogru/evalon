'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Bell,
  ExternalLink,
  Loader2,
  Pencil,
  Play,
  Plus,
  Trash2,
  Pause,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select-native'
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

function describeWatchlistCoverage(tickers: string[]): string {
  if (tickers.length === 0) {
    return 'No watchlist tickers configured.'
  }

  if (tickers.length <= 4) {
    return tickers.join(', ')
  }

  return `${tickers.slice(0, 4).join(', ')} +${tickers.length - 4} more`
}

function AlertsPreview({
  rules,
  newsRule,
  watchlistTickers,
  isLoading,
  isError,
}: {
  rules: AlertRule[]
  newsRule: WatchlistNewsAlertRule | null
  watchlistTickers: string[]
  isLoading: boolean
  isError: boolean
}) {
  const previewRules = rules.slice(0, 4)

  return (
    <div className="bg-background flex h-full flex-col">
      <div className="border-border bg-background sticky top-0 z-10 flex items-center justify-between border-b px-4 pt-4 pb-2">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <Bell size={16} />
            Alert Rules
          </p>
          <p className="text-muted-foreground text-[10px]">
            {rules.filter((rule) => rule.status === 'active').length +
              (newsRule?.status === 'active' ? 1 : 0)}{' '}
            active
          </p>
        </div>
        <Button asChild variant="ghost" size="sm" className="gap-1 text-xs">
          <Link href="/alerts">
            Open page
            <ExternalLink size={12} />
          </Link>
        </Button>
      </div>

      <div className="flex-1 overflow-auto px-2 py-2">
        {isLoading ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="text-primary h-5 w-5 animate-spin" />
          </div>
        ) : isError ? (
          <div className="border-destructive/30 bg-destructive/5 text-destructive rounded-xl border p-3 text-xs">
            Alert rules could not be loaded.
          </div>
        ) : previewRules.length === 0 && !newsRule ? (
          <div className="border-border text-muted-foreground rounded-xl border border-dashed p-4 text-center text-xs">
            No rules yet. Open the full page to create your first alert rule.
          </div>
        ) : (
          <div className="space-y-2">
            {previewRules.map((rule) => {
              const cadence = getAlertRuleCadence(rule.filters, rule.timeframe)

              return (
                <div
                  key={rule.id}
                  className="border-border bg-card rounded-xl border p-3"
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {rule.ticker}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          'text-[10px]',
                          rule.status === 'active'
                            ? 'border-primary/30 text-primary'
                            : 'border-muted text-muted-foreground'
                        )}
                      >
                        {rule.status}
                      </Badge>
                    </div>
                    <span className="text-muted-foreground text-[10px]">
                      {rule.timeframe}
                    </span>
                  </div>
                  <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                    {describeAlertRuleFilters(rule.filters, rule.logic)}
                  </p>
                  <p className="text-muted-foreground mt-2 text-[10px] tracking-wide uppercase">
                    {cadence.label}
                  </p>
                </div>
              )
            })}
            {newsRule ? (
              <div className="border-border bg-card rounded-xl border p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="truncate text-sm font-semibold">
                      Watchlist News
                    </span>
                    <Badge
                      variant="outline"
                      className={cn(
                        'text-[10px]',
                        newsRule.status === 'active'
                          ? 'border-primary/30 text-primary'
                          : 'border-muted text-muted-foreground'
                      )}
                    >
                      {newsRule.status}
                    </Badge>
                  </div>
                  <span className="text-muted-foreground text-[10px]">
                    {newsRule.burstWindowMinutes}m burst
                  </span>
                </div>
                <p className="text-muted-foreground mt-1 line-clamp-2 text-xs">
                  {formatSentiments(newsRule.sentiments)}
                </p>
                <p className="text-muted-foreground mt-2 text-[10px] tracking-wide uppercase">
                  {describeWatchlistCoverage(watchlistTickers)}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  )
}

export function AlertsView({ isWidget = false }: AlertsViewProps) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
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

  const activeRules = useMemo(
    () => rules.filter((rule) => rule.status === 'active'),
    [rules]
  )
  const activeNewsRules = useMemo(
    () => newsRules.filter((rule) => rule.status === 'active'),
    [newsRules]
  )

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
      return current.includes(sentiment)
        ? current.filter((item) => item !== sentiment)
        : [...current, sentiment]
    })
  }

  const resetNewsDraft = () => {
    setNewsSentimentsDraft(null)
  }

  const handleSaveNewsRule = async () => {
    setNewsFeedback(null)

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
    return (
      <AlertsPreview
        rules={rules}
        newsRule={currentNewsRule}
        watchlistTickers={watchlistTickers}
        isLoading={isLoading || isLoadingNewsRules}
        isError={isError || isNewsRulesError}
      />
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">Alert Rules</h1>
      </div>

      <Card className="border-border bg-card p-5">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <h2 className="text-lg font-semibold">Watchlist News Rule</h2>
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
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">Sentiment Filters</h3>
                </div>
                <Badge variant="outline" className="text-xs">
                  Fixed 10m burst
                </Badge>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {NEWS_SENTIMENT_OPTIONS.map((option) => {
                  const isSelected = newsSentiments.includes(option.value)

                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleToggleNewsSentiment(option.value)}
                      disabled={isNewsBusy}
                      aria-pressed={isSelected}
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
                  role="alert"
                  aria-live="polite"
                  className="border-chart-4/30 bg-chart-4/10 text-chart-4 mt-4 rounded-lg border p-3 text-sm"
                >
                  Add tickers to the watchlist before enabling watchlist news
                  alerts.
                </div>
              ) : null}

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    className="h-11 sm:h-9"
                    onClick={handleSaveNewsRule}
                    disabled={isNewsBusy || watchlistTickers.length === 0}
                  >
                    {isNewsBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : currentNewsRule ? (
                      'Update News Rule'
                    ) : (
                      <>
                        <Plus className="h-4 w-4" />
                        Create News Rule
                      </>
                    )}
                  </Button>
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
                  className="border-border bg-background/40 rounded-lg border p-4"
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

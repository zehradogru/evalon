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
    ALERT_RULE_MAX_FILTERS,
    describeAlertRuleFilters,
    getAlertRuleCadence,
    SUPPORTED_ALERT_TICKERS,
} from '@/lib/notification-rules'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/use-auth-store'
import type { AlertRule } from '@/types'
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

function AlertsPreview({
    rules,
    isLoading,
    isError,
}: {
    rules: AlertRule[]
    isLoading: boolean
    isError: boolean
}) {
    const previewRules = rules.slice(0, 4)

    return (
        <div className="flex h-full flex-col bg-background">
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background px-4 pb-2 pt-4">
                <div>
                    <p className="flex items-center gap-2 text-sm font-semibold">
                        <Bell size={16} />
                        Alert Rules
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                        {rules.filter((rule) => rule.status === 'active').length} active
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
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                ) : isError ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive">
                        Alert rules could not be loaded.
                    </div>
                ) : previewRules.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                        No rules yet. Open the full page to create your first alert rule.
                    </div>
                ) : (
                    <div className="space-y-2">
                        {previewRules.map((rule) => {
                            const cadence = getAlertRuleCadence(
                                rule.filters,
                                rule.timeframe
                            )

                            return (
                                <div
                                    key={rule.id}
                                    className="rounded-xl border border-border bg-card p-3"
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
                                        <span className="text-[10px] text-muted-foreground">
                                            {rule.timeframe}
                                        </span>
                                    </div>
                                    <p className="mt-1 text-xs text-muted-foreground line-clamp-2">
                                        {describeAlertRuleFilters(rule.filters, rule.logic)}
                                    </p>
                                    <p className="mt-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                                        {cadence.label}
                                    </p>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

export function AlertsView({ isWidget = false }: AlertsViewProps) {
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
    const { data: rules = [], isLoading, isError } = useAlertRules()
    const createRuleMutation = useCreateAlertRule()
    const updateRuleMutation = useUpdateAlertRule()
    const deleteRuleMutation = useDeleteAlertRule()
    const setRuleStatusMutation = useSetAlertRuleStatus()

    const [form, setForm] = useState<AlertRuleFormState>(DEFAULT_RULE_FORM)
    const [editingRuleId, setEditingRuleId] = useState<string | null>(null)
    const [feedback, setFeedback] = useState<string | null>(null)

    const isBusy =
        createRuleMutation.isPending ||
        updateRuleMutation.isPending ||
        deleteRuleMutation.isPending ||
        setRuleStatusMutation.isPending

    const activeRules = useMemo(
        () => rules.filter((rule) => rule.status === 'active'),
        [rules]
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
                error instanceof Error
                    ? error.message
                    : 'Rule could not be saved.'
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
                error instanceof Error
                    ? error.message
                    : 'Rule could not be deleted.'
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

    if (!isAuthenticated) {
        return (
            <div className={cn('flex h-full items-center justify-center', !isWidget && 'p-6')}>
                <Card className="max-w-md border-border bg-card p-6 text-center">
                    <h1 className="text-lg font-semibold">Sign in required</h1>
                    <p className="mt-2 text-sm text-muted-foreground">
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
                isLoading={isLoading}
                isError={isError}
            />
        )
    }

    return (
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 p-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Alert Rules</h1>
                <p className="text-muted-foreground">
                    Create ticker-based price and indicator rules, then deliver matches to the notification center.
                </p>
            </div>

            <Card className="border-border bg-card p-5">
                <div className="flex flex-col gap-4">
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
                                    <option
                                        key={timeframe.value}
                                        value={timeframe.value}
                                    >
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

                    <div className="rounded-2xl border border-border bg-background/40 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                                <h2 className="text-sm font-semibold">Conditions</h2>
                                <p className="text-xs text-muted-foreground">
                                    Up to {ALERT_RULE_MAX_FILTERS} conditions per rule.
                                </p>
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
                        <p className="text-sm text-destructive">{feedback}</p>
                    ) : null}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                            {editingRuleId
                                ? 'Updating a rule resets its current match state.'
                                : 'A rule notifies once per false-to-true transition.'}
                        </p>
                        <div className="flex items-center gap-2">
                            {editingRuleId ? (
                                <Button
                                    variant="ghost"
                                    onClick={handleCancelEdit}
                                    disabled={isBusy}
                                >
                                    Cancel
                                </Button>
                            ) : null}
                            <Button
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
                        <p className="text-sm text-muted-foreground">
                            {activeRules.length} active of {rules.length} total rules
                        </p>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-10">
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    </div>
                ) : isError ? (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
                        Alert rules could not be loaded.
                    </div>
                ) : rules.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                        No alert rules created yet.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {rules.map((rule) => {
                            const cadence = getAlertRuleCadence(
                                rule.filters,
                                rule.timeframe
                            )

                            return (
                                <div
                                    key={rule.id}
                                    id={`rule-${rule.id}`}
                                    className="rounded-2xl border border-border bg-background/40 p-4"
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

                                            <p className="mt-2 text-sm text-foreground">
                                                {describeAlertRuleFilters(
                                                    rule.filters,
                                                    rule.logic
                                                )}
                                            </p>

                                            <div className="mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground">
                                                <span>Cadence: {cadence.label}</span>
                                                <span>
                                                    Last trigger: {formatDateTime(rule.lastTriggeredAt)}
                                                </span>
                                                <span>
                                                    Next evaluation: {formatDateTime(rule.nextEvaluationAt)}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <Button
                                                variant="outline"
                                                size="sm"
                                                onClick={() => handleStartEdit(rule)}
                                                disabled={isBusy}
                                            >
                                                <Pencil className="h-4 w-4" />
                                                Edit
                                            </Button>
                                            <Button
                                                variant="outline"
                                                size="sm"
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
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive"
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

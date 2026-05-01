'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
    newsAlertRulesService,
    type SaveWatchlistNewsAlertRulePayload,
} from '@/services/news-alert-rules.service'
import { useAuthStore } from '@/store/use-auth-store'
import type { AlertRuleStatus, WatchlistNewsAlertRule } from '@/types'

const NEWS_ALERT_RULES_QUERY_KEY = 'news-alert-rules'

function useNewsAlertRulesCacheSync() {
    const queryClient = useQueryClient()
    const userId = useAuthStore((state) => state.user?.id ?? null)

    const syncRules = (rules: WatchlistNewsAlertRule[]) => {
        if (!userId) return
        queryClient.setQueryData([NEWS_ALERT_RULES_QUERY_KEY, userId], rules)
    }

    return { syncRules }
}

export function useNewsAlertRules() {
    const userId = useAuthStore((state) => state.user?.id ?? null)
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

    return useQuery({
        queryKey: [NEWS_ALERT_RULES_QUERY_KEY, userId],
        queryFn: () => newsAlertRulesService.getRules(),
        enabled: isAuthenticated && Boolean(userId),
        staleTime: 1000 * 60,
    })
}

export function useCreateNewsAlertRule() {
    const { syncRules } = useNewsAlertRulesCacheSync()

    return useMutation({
        mutationFn: (payload: SaveWatchlistNewsAlertRulePayload) =>
            newsAlertRulesService.createRule(payload),
        onSuccess: (rules) => {
            syncRules(rules)
        },
    })
}

export function useUpdateNewsAlertRule() {
    const { syncRules } = useNewsAlertRulesCacheSync()

    return useMutation({
        mutationFn: ({
            ruleId,
            payload,
        }: {
            ruleId: string
            payload: SaveWatchlistNewsAlertRulePayload
        }) => newsAlertRulesService.updateRule(ruleId, payload),
        onSuccess: (rules) => {
            syncRules(rules)
        },
    })
}

export function useSetNewsAlertRuleStatus() {
    const { syncRules } = useNewsAlertRulesCacheSync()

    return useMutation({
        mutationFn: ({
            ruleId,
            status,
        }: {
            ruleId: string
            status: AlertRuleStatus
        }) => newsAlertRulesService.setRuleStatus(ruleId, status),
        onSuccess: (rules) => {
            syncRules(rules)
        },
    })
}

export function useDeleteNewsAlertRule() {
    const { syncRules } = useNewsAlertRulesCacheSync()

    return useMutation({
        mutationFn: (ruleId: string) => newsAlertRulesService.deleteRule(ruleId),
        onSuccess: (rules) => {
            syncRules(rules)
        },
    })
}

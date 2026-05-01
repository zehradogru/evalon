'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import {
    alertRulesService,
    type SaveAlertRulePayload,
} from '@/services/alert-rules.service'
import { useAuthStore } from '@/store/use-auth-store'
import type { AlertRule, AlertRuleStatus } from '@/types'

const ALERT_RULES_QUERY_KEY = 'alert-rules'

function useAlertRulesCacheSync() {
    const queryClient = useQueryClient()
    const userId = useAuthStore((state) => state.user?.id ?? null)

    const syncRules = (rules: AlertRule[]) => {
        if (!userId) return
        queryClient.setQueryData([ALERT_RULES_QUERY_KEY, userId], rules)
    }

    return { syncRules, userId, queryClient }
}

export function useAlertRules() {
    const userId = useAuthStore((state) => state.user?.id ?? null)
    const isAuthenticated = useAuthStore((state) => state.isAuthenticated)

    return useQuery({
        queryKey: [ALERT_RULES_QUERY_KEY, userId],
        queryFn: () => alertRulesService.getOrCreateRules(),
        enabled: isAuthenticated && Boolean(userId),
        staleTime: 1000 * 60,
    })
}

export function useCreateAlertRule() {
    const { syncRules } = useAlertRulesCacheSync()

    return useMutation({
        mutationFn: (payload: SaveAlertRulePayload) =>
            alertRulesService.createRule(payload),
        onSuccess: (rules) => {
            syncRules(rules)
        },
    })
}

export function useUpdateAlertRule() {
    const { syncRules } = useAlertRulesCacheSync()

    return useMutation({
        mutationFn: ({
            ruleId,
            payload,
        }: {
            ruleId: string
            payload: SaveAlertRulePayload
        }) => alertRulesService.updateRule(ruleId, payload),
        onSuccess: (rules) => {
            syncRules(rules)
        },
    })
}

export function useSetAlertRuleStatus() {
    const { syncRules } = useAlertRulesCacheSync()

    return useMutation({
        mutationFn: ({
            ruleId,
            status,
        }: {
            ruleId: string
            status: AlertRuleStatus
        }) => alertRulesService.setRuleStatus(ruleId, status),
        onSuccess: (rules) => {
            syncRules(rules)
        },
    })
}

export function useDeleteAlertRule() {
    const { syncRules } = useAlertRulesCacheSync()

    return useMutation({
        mutationFn: (ruleId: string) => alertRulesService.deleteRule(ruleId),
        onSuccess: (rules) => {
            syncRules(rules)
        },
    })
}

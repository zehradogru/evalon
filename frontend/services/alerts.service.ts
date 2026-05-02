import { alertRulesService } from '@/services/alert-rules.service'
import type { UserAlert, UserAlertOperator } from '@/types'

export interface CreateAlertPayload {
    ticker: string
    operator: UserAlertOperator
    targetPrice: number
}

function mapRuleToLegacyAlert(rule: Awaited<ReturnType<typeof alertRulesService.getOrCreateRules>>[number]): UserAlert | null {
    if (rule.logic !== 'AND' || rule.filters.length !== 1) {
        return null
    }

    const filter = rule.filters[0]
    if (filter.type !== 'price' || (filter.op !== 'gt' && filter.op !== 'lt')) {
        return null
    }

    return {
        id: rule.id,
        ticker: rule.ticker,
        operator: filter.op,
        targetPrice: filter.value,
        status: rule.status === 'active' ? 'active' : 'triggered',
        createdAt: rule.createdAt,
        updatedAt: rule.updatedAt,
    }
}

export const alertsService = {
    async getOrCreateAlerts(): Promise<UserAlert[]> {
        const rules = await alertRulesService.getOrCreateRules()
        return rules
            .map(mapRuleToLegacyAlert)
            .filter((alert): alert is UserAlert => alert !== null)
    },

    async addAlert(payload: CreateAlertPayload): Promise<UserAlert[]> {
        await alertRulesService.createRule({
            ticker: payload.ticker,
            timeframe: '1d',
            logic: 'AND',
            filters: [
                {
                    type: 'price',
                    op: payload.operator,
                    value: payload.targetPrice,
                },
            ],
        })

        return this.getOrCreateAlerts()
    },

    async removeAlert(alertId: string): Promise<UserAlert[]> {
        await alertRulesService.deleteRule(alertId)
        return this.getOrCreateAlerts()
    },
}

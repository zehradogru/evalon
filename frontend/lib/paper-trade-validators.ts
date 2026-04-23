// ═══════════════════════════════════════════════════════════════
// Paper Trading — Validation Utilities
// ═══════════════════════════════════════════════════════════════

import { BIST_AVAILABLE } from '@/config/markets'
import type { CreateOrderRequest, PaperPortfolio } from '@/types/paper-trade'
import {
    PAPER_TRADE_INITIAL_BALANCE,
    PAPER_TRADE_COMMISSION_RATE,
    PAPER_TRADE_MAX_POSITION_WEIGHT,
    PAPER_TRADE_MAX_OPEN_ORDERS,
    PAPER_TRADE_MAX_QUANTITY,
    PAPER_TRADE_MIN_QUANTITY,
} from '@/types/paper-trade'

export interface ValidationResult {
    valid: boolean
    error?: string
}

/** Validate a ticker symbol exists in the available list */
export function validateTicker(ticker: string): ValidationResult {
    if (!ticker || typeof ticker !== 'string') {
        return { valid: false, error: 'Hisse kodu gereklidir.' }
    }
    if (!(BIST_AVAILABLE as readonly string[]).includes(ticker.toUpperCase())) {
        return { valid: false, error: `Geçersiz hisse kodu: ${ticker}` }
    }
    return { valid: true }
}

/** Validate order quantity */
export function validateQuantity(quantity: number): ValidationResult {
    if (!Number.isFinite(quantity) || quantity !== Math.floor(quantity)) {
        return { valid: false, error: 'Adet tam sayı olmalıdır.' }
    }
    if (quantity < PAPER_TRADE_MIN_QUANTITY) {
        return { valid: false, error: `Minimum adet: ${PAPER_TRADE_MIN_QUANTITY}` }
    }
    if (quantity > PAPER_TRADE_MAX_QUANTITY) {
        return { valid: false, error: `Maksimum adet: ${PAPER_TRADE_MAX_QUANTITY}` }
    }
    return { valid: true }
}

/** Validate price value */
export function validatePrice(price: number | null | undefined, label: string): ValidationResult {
    if (price === null || price === undefined) return { valid: true }
    if (!Number.isFinite(price) || price <= 0) {
        return { valid: false, error: `${label} sıfırdan büyük olmalıdır.` }
    }
    return { valid: true }
}

/** Calculate order total including commission */
export function calculateOrderTotal(quantity: number, price: number): {
    subtotal: number
    commission: number
    total: number
} {
    const subtotal = quantity * price
    const commission = Math.round(subtotal * PAPER_TRADE_COMMISSION_RATE * 100) / 100
    const total = Math.round((subtotal + commission) * 100) / 100
    return { subtotal, commission, total }
}

/** Validate sufficient balance for a buy order */
export function validateBalance(
    portfolio: PaperPortfolio,
    orderTotal: number,
    side: 'buy' | 'sell'
): ValidationResult {
    if (side === 'buy' && portfolio.cashBalance < orderTotal) {
        return {
            valid: false,
            error: `Yetersiz bakiye. Gerekli: ₺${orderTotal.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}, Mevcut: ₺${portfolio.cashBalance.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`,
        }
    }
    return { valid: true }
}

/** Validate sell quantity doesn't exceed held position */
export function validateSellQuantity(
    portfolio: PaperPortfolio,
    ticker: string,
    quantity: number
): ValidationResult {
    const position = portfolio.positions[ticker]
    if (!position) {
        return { valid: false, error: `${ticker} hissesine sahip değilsiniz.` }
    }
    if (quantity > position.quantity) {
        return {
            valid: false,
            error: `Sahip olduğunuzdan fazla satamazsınız. Mevcut: ${position.quantity} adet`,
        }
    }
    return { valid: true }
}

/** Validate position weight limit */
export function validatePositionWeight(
    portfolio: PaperPortfolio,
    ticker: string,
    additionalValue: number
): ValidationResult {
    const currentPositionValue = portfolio.positions[ticker]?.marketValue || 0
    const newPositionValue = currentPositionValue + additionalValue
    const totalPortfolioValue = portfolio.totalValue + additionalValue
    const weight = newPositionValue / totalPortfolioValue

    if (weight > PAPER_TRADE_MAX_POSITION_WEIGHT) {
        return {
            valid: false,
            error: `Tek hissede maksimum %${PAPER_TRADE_MAX_POSITION_WEIGHT * 100} ağırlık limiti aşılıyor. Mevcut ağırlık: %${(weight * 100).toFixed(1)}`,
        }
    }
    return { valid: true }
}

/** Validate open order count limit */
export function validateOpenOrderCount(currentOpenOrders: number): ValidationResult {
    if (currentOpenOrders >= PAPER_TRADE_MAX_OPEN_ORDERS) {
        return {
            valid: false,
            error: `Maksimum ${PAPER_TRADE_MAX_OPEN_ORDERS} açık emir limiti doldu.`,
        }
    }
    return { valid: true }
}

/** Full order validation pipeline */
export function validateOrder(
    req: CreateOrderRequest,
    portfolio: PaperPortfolio,
    currentPrice: number,
    openOrderCount: number
): ValidationResult {
    // 1. Ticker
    const tickerCheck = validateTicker(req.ticker)
    if (!tickerCheck.valid) return tickerCheck

    // 2. Quantity
    const qtyCheck = validateQuantity(req.quantity)
    if (!qtyCheck.valid) return qtyCheck

    // 3. Open order limit (for pending orders)
    if (req.type !== 'market') {
        const orderCountCheck = validateOpenOrderCount(openOrderCount)
        if (!orderCountCheck.valid) return orderCountCheck
    }

    // 4. Limit price validation
    if ((req.type === 'limit' || req.type === 'stop_limit') && req.limitPrice != null) {
        const lpCheck = validatePrice(req.limitPrice, 'Limit fiyatı')
        if (!lpCheck.valid) return lpCheck
    }

    // 5. Stop price validation
    if ((req.type === 'stop' || req.type === 'stop_limit') && req.stopPrice != null) {
        const spCheck = validatePrice(req.stopPrice, 'Stop fiyatı')
        if (!spCheck.valid) return spCheck
    }

    // 6. Stop-loss / take-profit
    if (req.stopLoss != null) {
        const slCheck = validatePrice(req.stopLoss, 'Stop-loss')
        if (!slCheck.valid) return slCheck
    }
    if (req.takeProfit != null) {
        const tpCheck = validatePrice(req.takeProfit, 'Take-profit')
        if (!tpCheck.valid) return tpCheck
    }

    // 7. Side-specific checks
    if (req.side === 'buy') {
        const effectivePrice = req.type === 'market' ? currentPrice : (req.limitPrice || currentPrice)
        const { total } = calculateOrderTotal(req.quantity, effectivePrice)
        const balCheck = validateBalance(portfolio, total, 'buy')
        if (!balCheck.valid) return balCheck

        // Position weight check
        const weightCheck = validatePositionWeight(portfolio, req.ticker, req.quantity * effectivePrice)
        if (!weightCheck.valid) return weightCheck
    } else {
        const sellCheck = validateSellQuantity(portfolio, req.ticker, req.quantity)
        if (!sellCheck.valid) return sellCheck
    }

    return { valid: true }
}

/** Create a default empty portfolio */
export function createDefaultPortfolio(userId: string, displayName: string): PaperPortfolio {
    const now = new Date().toISOString()
    return {
        userId,
        displayName,
        initialBalance: PAPER_TRADE_INITIAL_BALANCE,
        cashBalance: PAPER_TRADE_INITIAL_BALANCE,
        totalValue: PAPER_TRADE_INITIAL_BALANCE,
        totalPnL: 0,
        totalPnLPercent: 0,
        totalTrades: 0,
        winRate: 0,
        bestTrade: 0,
        worstTrade: 0,
        maxDrawdown: 0,
        sharpeRatio: 0,
        positions: {},
        createdAt: now,
        updatedAt: now,
        resetCount: 0,
    }
}

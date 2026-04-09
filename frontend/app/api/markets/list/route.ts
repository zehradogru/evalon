import { NextRequest, NextResponse } from 'next/server'
import {
    DEFAULT_MARKET_LIST_LIMIT,
    getPaginatedMarketList,
    MAX_MARKET_LIST_LIMIT,
} from '@/lib/server/bist-market-list'
import type { ListSortDirection, MarketListSortField, MarketListView } from '@/types'

const VALID_VIEWS: MarketListView[] = ['markets', 'screener']
const VALID_SORT_FIELDS: MarketListSortField[] = [
    'ticker',
    'price',
    'changePct',
    'changeVal',
    'high',
    'low',
    'vol',
    'rating',
    'marketCap',
    'pe',
    'eps',
    'sector',
]

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams

    const viewParam = searchParams.get('view')
    const view: MarketListView =
        viewParam && VALID_VIEWS.includes(viewParam as MarketListView)
            ? (viewParam as MarketListView)
            : 'markets'

    const limitParam = parseInt(searchParams.get('limit') || String(DEFAULT_MARKET_LIST_LIMIT), 10)
    const cursorParam = searchParams.get('cursor')
    const sortByParam = searchParams.get('sortBy')
    const sortDirParam = searchParams.get('sortDir')
    const q = searchParams.get('q') || undefined

    if (Number.isNaN(limitParam)) {
        return NextResponse.json({ error: 'Invalid limit parameter' }, { status: 400 })
    }

    if (limitParam < 1 || limitParam > MAX_MARKET_LIST_LIMIT) {
        return NextResponse.json(
            { error: `limit must be between 1 and ${MAX_MARKET_LIST_LIMIT}` },
            { status: 400 }
        )
    }

    if (sortByParam && !VALID_SORT_FIELDS.includes(sortByParam as MarketListSortField)) {
        return NextResponse.json({ error: 'Invalid sortBy parameter' }, { status: 400 })
    }

    if (sortDirParam && sortDirParam !== 'asc' && sortDirParam !== 'desc') {
        return NextResponse.json({ error: 'Invalid sortDir parameter' }, { status: 400 })
    }

    try {
        const response = await getPaginatedMarketList({
            view,
            limit: limitParam,
            cursor: cursorParam || undefined,
            sortBy: (sortByParam as MarketListSortField) || undefined,
            sortDir: (sortDirParam as ListSortDirection) || undefined,
            q,
        })

        return NextResponse.json(response, {
            headers: {
                'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=300',
            },
        })
    } catch (error) {
        console.error('Market list route error:', error)
        return NextResponse.json({ error: 'Failed to fetch market list' }, { status: 500 })
    }
}

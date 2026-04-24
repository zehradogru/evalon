import { NextRequest, NextResponse } from 'next/server'
import { DEFAULT_EVALON_API_URL } from '@/lib/evalon'

type ProxySearchParams =
    | URLSearchParams
    | Record<string, string | number | boolean | null | undefined>

interface ProxyOptions {
    baseUrl?: string
    cacheControl?: string
    pathname: string
    request?: NextRequest
    searchParams?: ProxySearchParams
    timeoutMs?: number
}

interface JsonProxyOptions extends ProxyOptions {
    body?: unknown
    method?: 'GET' | 'POST'
}

const EVALON_API_URL =
    process.env.NEXT_PUBLIC_EVALON_API_URL || DEFAULT_EVALON_API_URL

function toSearchParams(input?: ProxySearchParams): URLSearchParams {
    if (!input) return new URLSearchParams()
    if (input instanceof URLSearchParams) return new URLSearchParams(input)
    if (
        typeof input === 'object' &&
        input !== null &&
        'get' in input &&
        typeof input.get === 'function' &&
        'toString' in input
    ) {
        return new URLSearchParams(input.toString())
    }

    const params = new URLSearchParams()
    Object.entries(input).forEach(([key, value]) => {
        if (value === null || value === undefined || value === '') return
        params.set(key, String(value))
    })
    return params
}

async function readProxyPayload(response: Response): Promise<unknown> {
    const contentType = response.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
        return response.json()
    }

    const text = await response.text()
    return text ? { detail: text } : { detail: response.statusText || 'Request failed' }
}

export function buildEvalonUrl(
    pathname: string,
    searchParams?: ProxySearchParams,
    baseUrl?: string
): string {
    const normalizedPath = pathname.startsWith('/') ? pathname : `/${pathname}`
    const url = new URL(`${baseUrl ?? EVALON_API_URL}${normalizedPath}`)
    const params = toSearchParams(searchParams)
    params.forEach((value, key) => url.searchParams.set(key, value))
    return url.toString()
}

export async function fetchEvalonJson(
    pathname: string,
    options: Omit<JsonProxyOptions, 'pathname'> = {}
): Promise<Response> {
    const controller = new AbortController()
    const timeoutMs = options.timeoutMs ?? 15_000
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const url = buildEvalonUrl(
            pathname,
            options.searchParams ??
                (options.request ? options.request.nextUrl.searchParams : undefined),
            options.baseUrl
        )

        return await fetch(url, {
            method: options.method ?? 'GET',
            body: options.body === undefined ? undefined : JSON.stringify(options.body),
            cache: 'no-store',
            headers:
                options.body === undefined
                    ? undefined
                    : {
                          'Content-Type': 'application/json',
                      },
            signal: controller.signal,
        })
    } finally {
        clearTimeout(timeoutId)
    }
}

export async function proxyEvalonJson(
    options: JsonProxyOptions
): Promise<NextResponse> {
    try {
        const response = await fetchEvalonJson(options.pathname, options)
        const payload = await readProxyPayload(response)
        const headers = options.cacheControl
            ? { 'Cache-Control': options.cacheControl }
            : undefined

        return NextResponse.json(payload, {
            status: response.status,
            headers,
        })
    } catch (error) {
        console.error('Evalon proxy error:', error)
        return NextResponse.json(
            { detail: 'Failed to reach Evalon backend.' },
            { status: 500 }
        )
    }
}

export async function proxyEvalonGet(
    request: NextRequest,
    pathname: string,
    options: Omit<ProxyOptions, 'pathname' | 'request'> = {}
): Promise<NextResponse> {
    return proxyEvalonJson({
        ...options,
        pathname,
        request,
        method: 'GET',
    })
}

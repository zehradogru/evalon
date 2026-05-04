import { NextRequest } from 'next/server'
import { fetchEvalonJson, readProxyPayload } from '@/lib/server/evalon-proxy'
import { loadCoMovementFallback } from '@/lib/server/co-movement-local-loader'
import type {
    CoMovementCommunity,
    CoMovementDateRange,
    CoMovementMetrics,
    CoMovementPair,
} from '@/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const GEMINI_API_KEY = process.env.GEMINI_API_KEY
const GEMINI_MODEL =
    process.env.CO_MOVEMENT_EXPLAIN_MODEL ??
    process.env.AI_SUMMARY_MODEL ??
    'gemini-2.5-flash'

interface ExplainStreamBody {
    top_pairs?: unknown[]
    communities?: unknown[]
    metrics?: unknown
    language?: string
    symbols?: string[]
    date_range?: unknown
    insight_context?: unknown
}

function isCompleteSummary(summary: unknown): summary is string {
    if (typeof summary !== 'string') return false

    const trimmed = summary.trim()
    if (!trimmed) return false
    if ((trimmed.match(/\*\*/g) ?? []).length % 2 !== 0) return false

    return /[.!?…]$/.test(trimmed)
}

function buildPrompt(body: ExplainStreamBody): string {
    const lang = body.language?.toLowerCase().startsWith('tr') ? 'Turkish' : (body.language ?? 'Turkish')
    const communities = (body.communities ?? []) as Array<{ size?: number }>
    const topCommunities = [...communities]
        .sort((left, right) => (right.size ?? 0) - (left.size ?? 0))
        .slice(0, 5)
    return [
        `You are a financial data analysis assistant. Write in ${lang}.`,
        'Write a richer but concise co-movement interpretation using short Turkish section labels.',
        'Use only the provided computed metrics. Do not invent news, fundamentals, prices, forecasts, or trading signals.',
        'Cover: scope, strongest hybrid/Pearson/DTW relationships, community structure, rolling stability, data quality, and caveats.',
        'Prefer concrete ticker pairs and metric values when available.',
        'Do not give investment advice.',
        '',
        `Symbol count: ${body.symbols?.length ?? 0}`,
        `Date range: ${JSON.stringify(body.date_range ?? {})}`,
        `Top pairs (hybrid similarity): ${JSON.stringify((body.top_pairs ?? []).slice(0, 8))}`,
        `Largest communities: ${JSON.stringify(topCommunities)}`,
        `Metrics: ${JSON.stringify(body.metrics ?? {})}`,
        `Insight context: ${JSON.stringify(body.insight_context ?? {})}`,
    ].join('\n')
}

function getLocalFallbackInput(body: ExplainStreamBody) {
    return {
        top_pairs: Array.isArray(body.top_pairs)
            ? (body.top_pairs as CoMovementPair[])
            : [],
        communities: Array.isArray(body.communities)
            ? (body.communities as CoMovementCommunity[])
            : [],
        metrics:
            body.metrics && typeof body.metrics === 'object'
                ? (body.metrics as Partial<CoMovementMetrics>)
                : {},
        symbols: Array.isArray(body.symbols) ? body.symbols : [],
        date_range:
            body.date_range && typeof body.date_range === 'object'
                ? (body.date_range as Partial<CoMovementDateRange>)
                : {},
    }
}

export async function POST(request: NextRequest) {
    const body = (await request.json()) as ExplainStreamBody
    const encoder = new TextEncoder()
    const localFallback = await loadCoMovementFallback()

    function makeStream(
        gen: (controller: ReadableStreamDefaultController<Uint8Array>) => Promise<void>
    ): Response {
        return new Response(
            new ReadableStream({ start: gen }),
            {
                headers: {
                    'Content-Type': 'text/event-stream',
                    'Cache-Control': 'no-cache',
                    'X-Accel-Buffering': 'no',
                },
            }
        )
    }

    function sseChunk(data: unknown): Uint8Array {
        return encoder.encode(`data: ${JSON.stringify(data)}\n\n`)
    }

    function fallbackExplanation() {
        return localFallback
            ? localFallback.getLocalExplanation(getLocalFallbackInput(body))
            : {
                  summary: 'Yorum servisi şu anda kullanılamıyor.',
                  warnings: [] as string[],
                  source: 'fallback' as const,
                  model: null,
              }
    }

    // ── Direct Gemini streaming (when API key is available) ───────────────────
    if (GEMINI_API_KEY) {
        const prompt = buildPrompt(body)
        let geminiRes: Response

        try {
            geminiRes = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${GEMINI_API_KEY}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: {
                            temperature: 0.3,
                            maxOutputTokens: 2048,
                            thinkingConfig: { thinkingBudget: 0 },
                        },
                    }),
                }
            )
        } catch {
            geminiRes = new Response(null, { status: 503 })
        }

        if (geminiRes.ok && geminiRes.body) {
            return makeStream(async (controller) => {
                const reader = geminiRes.body!.getReader()
                const decoder = new TextDecoder()
                let buf = ''
                let fullText = ''

                const consumeLine = (line: string) => {
                    if (!line.startsWith('data: ')) return
                    const raw = line.slice(6).trim()
                    if (!raw || raw === '[DONE]') return

                    try {
                        const parsed = JSON.parse(raw)
                        for (const part of parsed?.candidates?.[0]?.content?.parts ?? []) {
                            if (part.thought) continue
                            const text: string = part.text ?? ''
                            if (!text) continue
                            fullText += text
                            controller.enqueue(sseChunk({ text }))
                        }
                    } catch {
                        // skip malformed SSE chunk
                    }
                }

                try {
                    while (true) {
                        const { done, value } = await reader.read()
                        if (done) break

                        buf += decoder.decode(value, { stream: true })
                        const lines = buf.split('\n')
                        buf = lines.pop() ?? ''

                        for (const line of lines) {
                            consumeLine(line)
                        }
                    }

                    if (buf.trim()) {
                        consumeLine(buf)
                    }
                } finally {
                    reader.releaseLock()
                }

                const finalPayload = isCompleteSummary(fullText)
                    ? {
                          done: true,
                          summary: fullText.trim(),
                          warnings: [],
                          source: 'llm',
                          model: GEMINI_MODEL,
                      }
                    : {
                          done: true,
                          ...fallbackExplanation(),
                      }

                controller.enqueue(
                    sseChunk(finalPayload)
                )
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                controller.close()
            })
        }
    }

    // ── Fallback: proxy to backend, then stream the text with typewriter effect ─
    try {
        const upstream = await fetchEvalonJson('/v1/co-movement/explain', {
            method: 'POST',
            body,
            timeoutMs: 60_000,
        })

        if (upstream.ok) {
            const upstreamPayload = (await readProxyPayload(upstream)) as {
                summary?: string
                warnings?: string[]
                source?: string
                model?: string | null
            }
            const payload =
                isCompleteSummary(upstreamPayload.summary)
                    ? upstreamPayload
                    : fallbackExplanation()

            const text = payload.summary ?? ''
            const CHUNK = 8

            return makeStream(async (controller) => {
                for (let i = 0; i < text.length; i += CHUNK) {
                    controller.enqueue(sseChunk({ text: text.slice(i, i + CHUNK) }))
                    await new Promise((resolve) => setTimeout(resolve, 25))
                }
                controller.enqueue(sseChunk({ done: true, ...payload }))
                controller.enqueue(encoder.encode('data: [DONE]\n\n'))
                controller.close()
            })
        }
    } catch {
        // fall through to local fallback
    }

    // ── Local heuristic fallback ───────────────────────────────────────────────
    const fallbackData = fallbackExplanation()

    return makeStream(async (controller) => {
        controller.enqueue(sseChunk({ done: true, ...fallbackData }))
        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
        controller.close()
    })
}

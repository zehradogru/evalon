'use client'

import dynamic from 'next/dynamic'
import type { ComponentType } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import {
    communityColor,
    createPairKey,
    edgeSourceId,
    edgeTargetId,
    endpointId,
} from './co-movement-utils'
import type { CoMovementEdge, CoMovementNode } from '@/types'

const ForceGraph2D = dynamic(
    () => import('react-force-graph-2d').then((module) => module.default),
    {
        ssr: false,
    }
) as unknown as ComponentType<Record<string, unknown>>

interface CoMovementGraphProps {
    title: string
    description: string
    nodes: CoMovementNode[]
    edges: CoMovementEdge[]
    selectedNodeId?: string | null
    onSelectNode?: (nodeId: string | null) => void
    height?: number
    className?: string
}

type GraphNode = CoMovementNode & {
    x?: number
    y?: number
}

type GraphLink = CoMovementEdge & {
    source: string | GraphNode
    target: string | GraphNode
}

function graphNodeId(node: string | GraphNode) {
    return endpointId(node)
}

export function CoMovementGraph({
    title,
    description,
    nodes,
    edges,
    selectedNodeId = null,
    onSelectNode,
    height = 520,
    className,
}: CoMovementGraphProps) {
    const containerRef = useRef<HTMLDivElement | null>(null)
    const [dimensions, setDimensions] = useState({ width: 800, height })
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null)

    const degreeMap = useMemo(() => {
        const result = new Map<string, number>()
        for (const edge of edges) {
            const source = edgeSourceId(edge)
            const target = edgeTargetId(edge)
            result.set(source, (result.get(source) ?? 0) + 1)
            result.set(target, (result.get(target) ?? 0) + 1)
        }
        return result
    }, [edges])

    const neighborMap = useMemo(() => {
        const result = new Map<string, Set<string>>()
        for (const edge of edges) {
            const source = edgeSourceId(edge)
            const target = edgeTargetId(edge)
            if (!source || !target) continue

            if (!result.has(source)) result.set(source, new Set())
            if (!result.has(target)) result.set(target, new Set())
            result.get(source)?.add(target)
            result.get(target)?.add(source)
        }
        return result
    }, [edges])

    const highlightedNodes = useMemo(() => {
        const activeId = hoveredNodeId || selectedNodeId
        if (!activeId) return new Set<string>()

        const result = new Set<string>([activeId])
        for (const neighbor of neighborMap.get(activeId) ?? []) {
            result.add(neighbor)
        }
        return result
    }, [hoveredNodeId, selectedNodeId, neighborMap])

    const highlightedLinks = useMemo(() => {
        const activeId = hoveredNodeId || selectedNodeId
        if (!activeId) return new Set<string>()

        const result = new Set<string>()
        for (const edge of edges) {
            const source = edgeSourceId(edge)
            const target = edgeTargetId(edge)
            if (source === activeId || target === activeId) {
                result.add(createPairKey(source, target))
            }
        }
        return result
    }, [edges, hoveredNodeId, selectedNodeId])

    useEffect(() => {
        if (!containerRef.current) return

        const element = containerRef.current
        const observer = new ResizeObserver((entries) => {
            const entry = entries[0]
            if (!entry) return

            setDimensions({
                width: Math.max(320, Math.floor(entry.contentRect.width)),
                height,
            })
        })

        observer.observe(element)
        return () => observer.disconnect()
    }, [height])

    const graphData = useMemo(() => {
        const orderedNodes = [...nodes].sort(
            (left, right) =>
                (left.community_id ?? 0) - (right.community_id ?? 0) ||
                left.id.localeCompare(right.id)
        )
        const indexById = new Map(
            orderedNodes.map((node, index) => [node.id, index])
        )
        const radius = Math.max(90, Math.min(260, orderedNodes.length * 5))

        return {
            nodes: nodes.map((node) => {
                const index = indexById.get(node.id) ?? 0
                const angle = (2 * Math.PI * index) / Math.max(1, orderedNodes.length)

                return {
                    ...node,
                    x: Math.cos(angle) * radius,
                    y: Math.sin(angle) * radius,
                }
            }),
            links: edges.map((edge) => ({
                ...edge,
                source: edgeSourceId(edge),
                target: edgeTargetId(edge),
            })),
        }
    }, [nodes, edges])

    return (
        <Card className={cn("border-border/60 bg-card/80 shadow-none", className)}>
            <CardHeader className="border-b border-border/50">
                <CardTitle className="text-base">{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent className="pt-6">
                {nodes.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 px-4 py-10 text-center text-sm text-muted-foreground">
                        Ağ grafiği verisi bekleniyor.
                    </div>
                ) : (
                    <div
                        ref={containerRef}
                        className="overflow-hidden rounded-2xl border border-border/50 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.08),_transparent_40%),linear-gradient(180deg,rgba(15,23,42,0.55),rgba(15,23,42,0.1))]"
                    >
                        <ForceGraph2D
                            width={dimensions.width}
                            height={dimensions.height}
                            graphData={graphData}
                            backgroundColor="rgba(0,0,0,0)"
                            cooldownTicks={120}
                            nodeRelSize={6}
                            linkDirectionalParticles={(link: GraphLink) =>
                                highlightedLinks.has(
                                    createPairKey(
                                        graphNodeId(link.source),
                                        graphNodeId(link.target)
                                    )
                                )
                                    ? 2
                                    : 0
                            }
                            linkDirectionalParticleWidth={2}
                            linkWidth={(link: GraphLink) => {
                                const linkKey = createPairKey(
                                    graphNodeId(link.source),
                                    graphNodeId(link.target)
                                )
                                return highlightedLinks.has(linkKey)
                                    ? 2 + link.weight * 6
                                    : 0.8 + link.weight * 3.5
                            }}
                            linkColor={(link: GraphLink) => {
                                const linkKey = createPairKey(
                                    graphNodeId(link.source),
                                    graphNodeId(link.target)
                                )
                                return highlightedLinks.has(linkKey)
                                    ? 'rgba(255,255,255,0.95)'
                                    : 'rgba(148,163,184,0.35)'
                            }}
                            nodeCanvasObject={(
                                node: GraphNode,
                                context: CanvasRenderingContext2D,
                                globalScale: number
                            ) => {
                                const nodeId = node.id
                                const nodeColor = communityColor(node.community_id)
                                const isHighlighted = highlightedNodes.has(nodeId)
                                const degree = degreeMap.get(nodeId) ?? 0
                                const x = node.x ?? 0
                                const y = node.y ?? 0
                                const radius = Math.max(
                                    4.5,
                                    Math.min(12, 5 + degree * 0.35)
                                )
                                const showLabel = isHighlighted || nodes.length <= 90
                                const fontSize = isHighlighted
                                    ? 12 / globalScale
                                    : 9 / globalScale

                                context.beginPath()
                                context.arc(x, y, radius, 0, 2 * Math.PI)
                                context.fillStyle = nodeColor
                                context.fill()

                                context.lineWidth = isHighlighted ? 2 : 1
                                context.strokeStyle = isHighlighted
                                    ? 'rgba(255,255,255,0.95)'
                                    : 'rgba(15,23,42,0.7)'
                                context.stroke()

                                if (showLabel) {
                                    context.font = `${fontSize}px sans-serif`
                                    context.textAlign = 'center'
                                    context.textBaseline = 'top'
                                    context.fillStyle = 'rgba(241,245,249,0.95)'
                                    context.fillText(node.label, x, y + radius + 2)
                                }
                            }}
                            onNodeHover={(node: GraphNode | null) => {
                                setHoveredNodeId(node ? node.id : null)
                            }}
                            onNodeClick={(node: GraphNode | null) => {
                                onSelectNode?.(node ? node.id : null)
                            }}
                        />
                    </div>
                )}

                <div className="mt-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                    <span>Node rengi community kimliğini gösterir.</span>
                    <span>Node boyutu bağlantı yoğunluğu arttıkça büyür.</span>
                    <span>Edge kalınlığı hybrid similarity ağırlığına göre ölçeklenir.</span>
                </div>
            </CardContent>
        </Card>
    )
}

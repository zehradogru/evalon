'use client'

import { useState, useMemo } from 'react'
import {
    Activity, TrendingUp, TrendingDown, BookOpen, Calculator, DollarSign,
    Percent, BarChart2, GitBranch, GitMerge, Minus, ArrowUpDown,
    ArrowLeftRight, Package, ShieldAlert, Target, Layers, Clock,
    ToggleRight, Ticket, BarChart3, Award, Rocket, LineChart,
    CandlestickChart, Droplets, GraduationCap,
} from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    academyTerms,
    academyCategories,
    type AcademyTerm,
    type AcademyCategory,
} from '@/data/academy'

// ── Icon resolver ────────────────────────────────────────────────────────────
const ICON_MAP: Record<string, React.ElementType> = {
    Activity, TrendingUp, TrendingDown, BookOpen, Calculator, DollarSign,
    Percent, BarChart2, GitBranch, GitMerge, Minus, ArrowUpDown,
    ArrowLeftRight, Package, ShieldAlert, Target, Layers, Clock,
    ToggleRight, Ticket, BarChart3, Award, Rocket, LineChart,
    CandlestickChart, Droplets, GraduationCap,
}

function TermIcon({ name, className }: { name: string; className?: string }) {
    const Icon = ICON_MAP[name] ?? Activity
    return <Icon className={className} />
}

// ── Category badge colours ───────────────────────────────────────────────────
const categoryColors: Record<AcademyCategory, string> = {
    'Technical Analysis': 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    'Fundamental Analysis': 'bg-purple-500/15 text-purple-400 border-purple-500/30',
    'General Concepts': 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    'Derivatives': 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    'Market Types': 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
}

// ── Term Card ────────────────────────────────────────────────────────────────
function TermCard({
    term,
    onClick,
}: {
    term: AcademyTerm
    onClick: () => void
}) {
    return (
        <button
            onClick={onClick}
            className="group w-full text-left rounded-xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:bg-muted/30 hover:shadow-lg hover:shadow-primary/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        >
            {/* Icon + Badge row */}
            <div className="flex items-start justify-between gap-2 mb-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                    <TermIcon name={term.icon} className="h-4 w-4 text-primary" />
                </div>
                <span
                    className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-medium ${categoryColors[term.category]}`}
                >
                    {term.category}
                </span>
            </div>

            {/* Title */}
            <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors leading-snug">
                {term.title}
            </h3>
            {term.title !== term.fullName && (
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">
                    {term.fullName}
                </p>
            )}

            {/* Short description */}
            <p className="mt-2 text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                {term.short}
            </p>

            {/* Hover CTA */}
            <p className="mt-3 text-[10px] font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                View details →
            </p>
        </button>
    )
}

// ── Detail Dialog ────────────────────────────────────────────────────────────
function TermDialog({
    term,
    open,
    onClose,
}: {
    term: AcademyTerm | null
    open: boolean
    onClose: () => void
}) {
    if (!term) return null
    return (
        <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
            <DialogContent className="max-w-lg bg-card border-border">
                <DialogHeader>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                            <TermIcon name={term.icon} className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                            <DialogTitle className="text-base">{term.title}</DialogTitle>
                            {term.title !== term.fullName && (
                                <p className="text-xs text-muted-foreground mt-0.5">{term.fullName}</p>
                            )}
                        </div>
                    </div>
                    <span
                        className={`self-start inline-flex items-center rounded-md border px-2.5 py-1 text-[11px] font-medium ${categoryColors[term.category]}`}
                    >
                        {term.category}
                    </span>
                </DialogHeader>

                <ScrollArea className="max-h-72 pr-1">
                    <DialogDescription asChild>
                        <div className="space-y-4 text-sm text-foreground">
                            <p className="leading-relaxed">{term.long}</p>
                            {term.formula && (
                                <div className="rounded-lg bg-muted/50 border border-border px-4 py-3">
                                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                                        Formula
                                    </p>
                                    <code className="text-xs font-mono text-primary">{term.formula}</code>
                                </div>
                            )}
                        </div>
                    </DialogDescription>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}

// ── Main View ────────────────────────────────────────────────────────────────
export function AcademyView() {
    const [query, setQuery] = useState('')
    const [activeCategory, setActiveCategory] = useState<AcademyCategory | 'All'>('All')
    const [selectedTerm, setSelectedTerm] = useState<AcademyTerm | null>(null)
    const [dialogOpen, setDialogOpen] = useState(false)

    const filtered = useMemo(() => {
        const q = query.toLowerCase().trim()
        return academyTerms.filter((term) => {
            const matchesCategory =
                activeCategory === 'All' || term.category === activeCategory
            if (!matchesCategory) return false
            if (!q) return true
            return (
                term.title.toLowerCase().includes(q) ||
                term.fullName.toLowerCase().includes(q) ||
                term.short.toLowerCase().includes(q) ||
                term.long.toLowerCase().includes(q)
            )
        })
    }, [query, activeCategory])

    const handleCardClick = (term: AcademyTerm) => {
        setSelectedTerm(term)
        setDialogOpen(true)
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 shrink-0">
                    <GraduationCap className="h-6 w-6 text-primary" />
                </div>
                <div>
                    <h1 className="text-xl font-bold text-foreground">Stock Market Academy</h1>
                    <p className="text-sm text-muted-foreground mt-0.5">
                        {academyTerms.length} terms · Technical, fundamental analysis and market concepts
                    </p>
                </div>
            </div>

            {/* Search + Filters */}
            <div className="space-y-3">
                <Input
                    placeholder="Search terms or concepts…"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="bg-card border-border max-w-md"
                />

                <div className="flex flex-wrap gap-2">
                    {(['All', ...academyCategories] as const).map((cat) => (
                        <Button
                            key={cat}
                            variant="outline"
                            size="sm"
                            onClick={() => setActiveCategory(cat)}
                            className={`rounded-full text-xs h-7 px-3 transition-colors ${
                                activeCategory === cat
                                    ? 'bg-primary text-primary-foreground border-primary hover:bg-primary/90'
                                    : 'border-border text-muted-foreground hover:text-foreground hover:border-foreground/30'
                            }`}
                        >
                            {cat}
                        </Button>
                    ))}
                </div>
            </div>

            {/* Results count */}
            {query && (
                <p className="text-xs text-muted-foreground">
                    {filtered.length} results found
                </p>
            )}

            {/* Grid */}
            {filtered.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <GraduationCap className="h-10 w-10 text-muted-foreground/40 mb-3" />
                    <p className="text-sm text-muted-foreground">
                        &quot;{query}&quot; not found.
                    </p>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 text-xs"
                        onClick={() => { setQuery(''); setActiveCategory('All') }}
                    >
                        Filtreleri temizle
                    </Button>
                </div>
            ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filtered.map((term) => (
                        <TermCard key={term.slug} term={term} onClick={() => handleCardClick(term)} />
                    ))}
                </div>
            )}

            {/* Detail Dialog */}
            <TermDialog
                term={selectedTerm}
                open={dialogOpen}
                onClose={() => setDialogOpen(false)}
            />
        </div>
    )
}

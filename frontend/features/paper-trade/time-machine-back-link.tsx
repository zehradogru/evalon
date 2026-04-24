'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export function TimeMachineBackLink() {
    return (
        <Link
            href="/paper-trade"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
            <ArrowLeft size={12} />
            Back to Paper Trade
        </Link>
    )
}

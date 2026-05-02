'use client'

import { useSimulatorStore } from '@/store/use-simulator-store'
import { SimulatorSetupPanel } from './simulator-setup-panel'
import { SimulatorGamePanel } from './simulator-game-panel'
import { SimulatorResults } from './simulator-results'

export function SimulatorShell() {
    const status = useSimulatorStore((s) => s.status)
    const resetSimulation = useSimulatorStore((s) => s.resetSimulation)

    // On first load, if idle → show setup
    const effectiveStatus = status === 'idle' ? 'setup' : status

    return (
        <div className="flex-1 bg-background">
            {effectiveStatus === 'setup' && <SimulatorSetupPanel />}
            {effectiveStatus === 'playing' && <SimulatorGamePanel />}
            {effectiveStatus === 'finished' && (
                <SimulatorResults onPlayAgain={resetSimulation} />
            )}
        </div>
    )
}

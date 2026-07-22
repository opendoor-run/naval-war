import { useState } from 'react'
import { InstructionsModal } from './InstructionsModal'
import type { GameLogRow } from '../types/game'

export function GameLog({ log }: { log: GameLogRow[] }) {
  const [showInstructions, setShowInstructions] = useState(false)

  return (
    <div className="ptc-panel ptc-clipboard ptc-rivets flex h-full flex-col p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="ptc-headline text-sm">Radio Log</p>
        <button onClick={() => setShowInstructions(true)} className="ptc-btn px-2 py-0.5 text-[10px]">
          Rules
        </button>
      </div>
      <div className="ptc-mono flex-1 space-y-1 overflow-y-auto text-xs text-[var(--ink-soft)]">
        {log.length === 0 && <p>Nothing yet.</p>}
        {log.map((entry) => (
          <p key={entry.id}>
            <span style={{ color: 'var(--red)' }}>»</span> {entry.message}
          </p>
        ))}
      </div>
      {showInstructions && <InstructionsModal onClose={() => setShowInstructions(false)} />}
    </div>
  )
}

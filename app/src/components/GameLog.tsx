import type { GameLogRow } from '../types/game'

export function GameLog({ log }: { log: GameLogRow[] }) {
  return (
    <div className="ptc-panel ptc-clipboard ptc-rivets flex h-full flex-col p-3">
      <p className="ptc-headline mb-2 text-sm">Radio Log</p>
      <div className="ptc-mono flex-1 space-y-1 overflow-y-auto text-xs text-[var(--ink-soft)]">
        {log.length === 0 && <p>Nothing yet.</p>}
        {log.map((entry) => (
          <p key={entry.id}>
            <span style={{ color: 'var(--red)' }}>»</span> {entry.message}
          </p>
        ))}
      </div>
    </div>
  )
}

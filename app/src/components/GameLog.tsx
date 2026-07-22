import type { GameLogRow } from '../types/game'

export function GameLog({ log }: { log: GameLogRow[] }) {
  return (
    <div className="flex h-full flex-col rounded-xl border border-white/15 bg-black/25 p-3">
      <p className="mb-2 text-sm font-medium text-white/70">Log</p>
      <div className="flex-1 space-y-1 overflow-y-auto text-xs text-white/70">
        {log.length === 0 && <p className="text-white/40">Nothing yet.</p>}
        {log.map((entry) => (
          <p key={entry.id}>{entry.message}</p>
        ))}
      </div>
    </div>
  )
}

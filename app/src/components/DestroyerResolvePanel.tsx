import { useState } from 'react'
import { getShip } from '../lib/cards'
import type { GamePlayerRow, TaskForceRow } from '../types/game'

export function DestroyerResolvePanel({
  myUserId,
  players,
  taskForces,
  onConfirm,
  busy,
}: {
  myUserId: string
  players: GamePlayerRow[]
  taskForces: Record<string, TaskForceRow>
  onConfirm: (targetOwnerId: string, priorityShipIds: string[]) => void
  busy: boolean
}) {
  const opponents = players.filter((p) => p.user_id !== myUserId && !p.is_eliminated_this_round)
  const [targetOwnerId, setTargetOwnerId] = useState<string | null>(null)
  const [priority, setPriority] = useState<string[]>([])

  const targetForce = targetOwnerId ? taskForces[targetOwnerId] : undefined

  function toggleShip(shipId: string) {
    setPriority((prev) => (prev.includes(shipId) ? prev.filter((id) => id !== shipId) : [...prev, shipId]))
  }

  return (
    <div className="rounded-xl border border-red-400/40 bg-black/40 p-4">
      <p className="mb-1 font-semibold text-white">Your Destroyer Squadron attacks!</p>
      <p className="mb-3 text-xs text-white/60">
        Choose the target fleet, then click ships in the order you'd want them sunk if the roll allows it.
      </p>
      <div className="mb-3 flex flex-wrap gap-2">
        {opponents.map((p) => (
          <button
            key={p.user_id}
            onClick={() => {
              setTargetOwnerId(p.user_id)
              setPriority([])
            }}
            className={`rounded border px-2 py-1 text-xs ${
              targetOwnerId === p.user_id ? 'border-amber-300 bg-amber-400/20' : 'border-white/20 bg-white/5'
            }`}
          >
            {p.display_name}
          </button>
        ))}
      </div>

      {targetForce && (
        <div className="mb-3 flex flex-wrap gap-2">
          {targetForce.ships
            .filter((s) => !s.sunk)
            .map((s) => {
              const order = priority.indexOf(s.shipId)
              return (
                <button
                  key={s.shipId}
                  onClick={() => toggleShip(s.shipId)}
                  className={`relative rounded border px-2 py-1 text-xs ${
                    order >= 0 ? 'border-amber-300 bg-amber-400/20' : 'border-white/20 bg-white/5'
                  }`}
                >
                  {order >= 0 && <span className="mr-1 font-bold">{order + 1}.</span>}
                  {getShip(s.shipId).name}
                </button>
              )
            })}
        </div>
      )}

      <button
        onClick={() => targetOwnerId && onConfirm(targetOwnerId, priority)}
        disabled={!targetOwnerId || priority.length === 0 || busy}
        className="rounded-md bg-red-400 px-4 py-1.5 text-sm font-semibold text-black hover:bg-red-300 disabled:opacity-40"
      >
        {busy ? 'Rolling...' : 'Roll and attack'}
      </button>
    </div>
  )
}

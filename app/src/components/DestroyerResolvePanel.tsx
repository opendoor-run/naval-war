import { useState } from 'react'
import { getShip } from '../lib/cards'
import type { GamePlayerRow, TaskForceRow } from '../types/game'

function chip(active: boolean): string {
  return `ptc-chip px-2 py-1 text-xs ${active ? 'ptc-chip-active' : ''}`
}

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
    <div className="ptc-panel ptc-rivets p-4" style={{ borderColor: 'var(--red)', borderWidth: 1.5 }}>
      <p className="ptc-headline text-sm" style={{ color: 'var(--red)' }}>
        Your Destroyer Squadron Attacks!
      </p>
      <p className="ptc-mono mb-3 text-xs text-[var(--ink-soft)]">
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
            className={chip(targetOwnerId === p.user_id)}
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
                <button key={s.shipId} onClick={() => toggleShip(s.shipId)} className={chip(order >= 0)}>
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
        className="ptc-btn ptc-btn-danger px-4 py-1.5 text-sm"
      >
        {busy ? 'Rolling...' : 'Roll and Attack'}
      </button>
    </div>
  )
}

import { useState } from 'react'
import { getShip } from '../lib/cards'
import type { AirstrikeDeclaration, GamePlayerRow, TaskForceRow } from '../types/game'

function chip(active: boolean): string {
  return `ptc-chip px-2 py-0.5 text-xs ${active ? 'ptc-chip-active' : ''}`
}

export function AirstrikePanel({
  myUserId,
  myForce,
  players,
  taskForces,
  onConfirm,
  onCancel,
  busy,
}: {
  myUserId: string
  myForce: TaskForceRow
  players: GamePlayerRow[]
  taskForces: Record<string, TaskForceRow>
  onConfirm: (strikes: AirstrikeDeclaration[]) => void
  onCancel: () => void
  busy: boolean
}) {
  const carriers = myForce.ships.filter((s) => !s.sunk && getShip(s.shipId).isCarrier)
  // Smoke blocks airstrikes.
  const opponents = players.filter(
    (p) => p.user_id !== myUserId && !p.is_eliminated_this_round && !taskForces[p.user_id]?.smoke_active
  )
  const [assignments, setAssignments] = useState<Record<string, { ownerId: string; shipId: string }>>({})

  function setOwner(carrierShipId: string, ownerId: string) {
    setAssignments((prev) => ({ ...prev, [carrierShipId]: { ownerId, shipId: '' } }))
  }
  function setShip(carrierShipId: string, shipId: string) {
    setAssignments((prev) => ({ ...prev, [carrierShipId]: { ...prev[carrierShipId], shipId } }))
  }

  const strikes: AirstrikeDeclaration[] = Object.entries(assignments)
    .filter(([, v]) => v.ownerId && v.shipId)
    .map(([carrierShipId, v]) => ({ carrierShipId, targetOwnerId: v.ownerId, targetShipId: v.shipId }))

  return (
    <div className="ptc-panel ptc-rivets p-4">
      <p className="ptc-headline mb-3 text-sm">Declare Airstrikes</p>
      <div className="space-y-3">
        {carriers.map((c) => {
          const assignment = assignments[c.shipId]
          const targetForce = assignment?.ownerId ? taskForces[assignment.ownerId] : undefined
          return (
            <div key={c.shipId} className="border border-[var(--navy-deep)] bg-[var(--parchment)] p-2">
              <p className="ptc-mono mb-1 text-sm text-[var(--ink)]">{getShip(c.shipId).name}</p>
              <div className="mb-2 flex flex-wrap gap-1">
                {opponents.map((p) => (
                  <button key={p.user_id} onClick={() => setOwner(c.shipId, p.user_id)} className={chip(assignment?.ownerId === p.user_id)}>
                    {p.display_name}
                  </button>
                ))}
              </div>
              {targetForce && (
                <div className="flex flex-wrap gap-1">
                  {targetForce.ships
                    .filter((s) => !s.sunk)
                    .map((s) => (
                      <button key={s.shipId} onClick={() => setShip(c.shipId, s.shipId)} className={chip(assignment?.shipId === s.shipId)}>
                        {getShip(s.shipId).name}
                      </button>
                    ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-3 flex gap-2">
        <button onClick={() => onConfirm(strikes)} disabled={strikes.length === 0 || busy} className="ptc-btn ptc-btn-primary px-4 py-1.5 text-sm">
          {busy ? 'Working...' : `Launch ${strikes.length || ''} Strike${strikes.length === 1 ? '' : 's'}`}
        </button>
        <button onClick={onCancel} disabled={busy} className="ptc-btn px-4 py-1.5 text-sm">
          Cancel
        </button>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { getShip } from '../lib/cards'
import type { AirstrikeDeclaration, GamePlayerRow, TaskForceRow } from '../types/game'

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
  const opponents = players.filter((p) => p.user_id !== myUserId && !p.is_eliminated_this_round)
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
    <div className="rounded-xl border border-amber-300/40 bg-black/40 p-4">
      <p className="mb-3 font-semibold text-white">Declare airstrikes</p>
      <div className="space-y-3">
        {carriers.map((c) => {
          const assignment = assignments[c.shipId]
          const targetForce = assignment?.ownerId ? taskForces[assignment.ownerId] : undefined
          return (
            <div key={c.shipId} className="rounded-lg border border-white/10 bg-white/5 p-2">
              <p className="mb-1 text-sm text-white/80">{getShip(c.shipId).name}</p>
              <div className="mb-2 flex flex-wrap gap-1">
                {opponents.map((p) => (
                  <button
                    key={p.user_id}
                    onClick={() => setOwner(c.shipId, p.user_id)}
                    className={`rounded border px-2 py-0.5 text-xs ${
                      assignment?.ownerId === p.user_id ? 'border-amber-300 bg-amber-400/20' : 'border-white/20'
                    }`}
                  >
                    {p.display_name}
                  </button>
                ))}
              </div>
              {targetForce && (
                <div className="flex flex-wrap gap-1">
                  {targetForce.ships
                    .filter((s) => !s.sunk)
                    .map((s) => (
                      <button
                        key={s.shipId}
                        onClick={() => setShip(c.shipId, s.shipId)}
                        className={`rounded border px-2 py-0.5 text-xs ${
                          assignment?.shipId === s.shipId ? 'border-amber-300 bg-amber-400/20' : 'border-white/20'
                        }`}
                      >
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
        <button
          onClick={() => onConfirm(strikes)}
          disabled={strikes.length === 0 || busy}
          className="rounded-md bg-amber-400 px-4 py-1.5 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-40"
        >
          {busy ? 'Working...' : `Launch ${strikes.length || ''} strike${strikes.length === 1 ? '' : 's'}`}
        </button>
        <button
          onClick={onCancel}
          disabled={busy}
          className="rounded-md border border-white/20 px-4 py-1.5 text-sm text-white/80 hover:bg-white/10"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}

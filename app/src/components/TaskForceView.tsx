import { getShip } from '../lib/cards'
import { CardImage } from './CardImage'
import type { TaskForceRow } from '../types/game'

export function TaskForceView({
  force,
  ownerName,
  isMine,
  selectable,
  selectedShipId,
  onSelectShip,
}: {
  force: TaskForceRow | undefined
  ownerName: string
  isMine: boolean
  selectable?: boolean
  selectedShipId?: string | null
  onSelectShip?: (shipId: string) => void
}) {
  if (!force) return null
  const aliveShips = force.ships.filter((s) => !s.sunk)
  const sunkShips = force.ships.filter((s) => s.sunk)

  return (
    <div
      className={`rounded-xl border p-3 ${
        isMine ? 'border-amber-300/40 bg-amber-400/5' : 'border-white/15 bg-black/20'
      }`}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="font-semibold text-white">{ownerName}</span>
        {isMine && <span className="rounded bg-amber-400/20 px-1.5 py-0.5 text-[10px] text-amber-300">You</span>}
        {force.smoke_active && (
          <span className="rounded bg-slate-400/20 px-1.5 py-0.5 text-[10px] text-slate-300">Smoke</span>
        )}
        {force.minefields.length > 0 && (
          <span className="rounded bg-red-400/20 px-1.5 py-0.5 text-[10px] text-red-300">
            {force.minefields.length} Minefield{force.minefields.length > 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto text-xs text-white/50">Deep Six: {force.deep_six.length}</span>
      </div>

      <div className="flex flex-wrap gap-2">
        {aliveShips.map((s) => {
          const card = getShip(s.shipId)
          const isSelected = selectedShipId === s.shipId
          return (
            <div key={s.shipId} className="relative">
              <CardImage
                cardId={s.shipId}
                size="sm"
                selected={isSelected}
                onClick={selectable ? () => onSelectShip?.(s.shipId) : undefined}
              />
              {s.damage > 0 && (
                <div className="absolute -bottom-1 -right-1 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-bold text-white shadow">
                  {s.damage}/{card.hitPoints}
                </div>
              )}
            </div>
          )
        })}
        {sunkShips.map((s) => (
          <div key={s.shipId} className="relative opacity-30">
            <CardImage cardId={s.shipId} size="sm" dim />
            <div className="absolute inset-0 flex items-center justify-center text-lg">💀</div>
          </div>
        ))}
        {force.ships.length === 0 && <p className="text-sm text-white/40">No ships</p>}
      </div>
    </div>
  )
}

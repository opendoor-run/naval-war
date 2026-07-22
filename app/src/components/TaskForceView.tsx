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
      className="ptc-panel ptc-rivets p-3"
      style={isMine ? { borderLeft: '4px solid var(--amber)' } : undefined}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="ptc-headline text-base">{ownerName}</span>
        {isMine && <span className="ptc-stamp px-1.5 py-0.5 text-[10px]">You</span>}
        {force.smoke_active && <span className="ptc-stamp px-1.5 py-0.5 text-[10px]">Smoke</span>}
        {force.minefields.length > 0 && (
          <span className="ptc-stamp px-1.5 py-0.5 text-[10px]">
            {force.minefields.length} Minefield{force.minefields.length > 1 ? 's' : ''}
          </span>
        )}
        <span className="ptc-mono ml-auto text-xs text-[var(--ink-soft)]">Deep Six: {force.deep_six.length}</span>
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
                <div className="ptc-mono absolute -bottom-1 -right-1 border border-[var(--navy-deep)] bg-[var(--amber)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--navy-deep)]">
                  {s.damage}/{card.hitPoints}
                </div>
              )}
            </div>
          )
        })}
        {sunkShips.map((s) => (
          <div key={s.shipId} className="relative w-24 shrink-0" style={{ aspectRatio: '5 / 3' }}>
            <CardImage cardId={s.shipId} size="sm" dim />
            <div
              className="ptc-stamp pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 py-0.5 text-center text-[10px]"
            >
              Sunk
            </div>
          </div>
        ))}
        {force.ships.length === 0 && <p className="ptc-mono text-sm text-[var(--ink-soft)]">No ships</p>}
      </div>
    </div>
  )
}

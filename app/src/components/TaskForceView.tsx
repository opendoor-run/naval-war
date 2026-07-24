import { memo, useEffect, useRef, useState } from 'react'
import { getShip } from '../lib/cards'
import { CardImage } from './CardImage'
import { ShipTooltip } from './ShipTooltip'
import type { GamePlayerRow, ShipState, TaskForceRow } from '../types/game'

const HIT_EXPLOSION_MS = 650
const SINK_EXPLOSION_MS = HIT_EXPLOSION_MS * 2

/** One ship's card, alive or sunk. Kept as a single component across that transition (rather
    than two separate alive/sunk render paths) so its explosion-tracking refs survive the sink
    moment instead of remounting - a hit flashes a short burst, a sink flashes twice as long. */
function ShipCard({
  ship,
  hitPoints,
  isSelected,
  onSelect,
  players,
}: {
  ship: ShipState
  hitPoints: number
  isSelected: boolean
  onSelect: (() => void) | undefined
  players: GamePlayerRow[]
}) {
  const prevDamage = useRef(ship.damage)
  const prevSunk = useRef(ship.sunk)
  const [explosionMs, setExplosionMs] = useState<number | null>(null)

  useEffect(() => {
    const justSunk = ship.sunk && !prevSunk.current
    const tookDamage = !ship.sunk && ship.damage > prevDamage.current
    if (justSunk) setExplosionMs(SINK_EXPLOSION_MS)
    else if (tookDamage) setExplosionMs(HIT_EXPLOSION_MS)
    prevDamage.current = ship.damage
    prevSunk.current = ship.sunk
  }, [ship.damage, ship.sunk])

  useEffect(() => {
    if (explosionMs === null) return
    const t = setTimeout(() => setExplosionMs(null), explosionMs)
    return () => clearTimeout(t)
  }, [explosionMs])

  const explosion = explosionMs !== null && (
    <div className="ptc-explosion-overlay" style={{ animationDuration: `${explosionMs}ms` }} />
  )

  if (ship.sunk) {
    return (
      <div className="group relative w-24 shrink-0" style={{ aspectRatio: '5 / 3' }}>
        <CardImage cardId={ship.shipId} size="sm" dim />
        <div className="ptc-stamp pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 py-0.5 text-center text-[10px]">
          Sunk
        </div>
        {explosion}
        <ShipTooltip ship={ship} players={players} />
      </div>
    )
  }

  return (
    <div className="group relative">
      <CardImage cardId={ship.shipId} size="sm" selected={isSelected} onClick={onSelect} />
      {ship.damage > 0 && (
        <div className="ptc-mono absolute -bottom-1 -right-1 border border-[var(--navy-deep)] bg-[var(--amber)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--navy-deep)]">
          {ship.damage}/{hitPoints}
        </div>
      )}
      {explosion}
      <ShipTooltip ship={ship} players={players} />
    </div>
  )
}

export const TaskForceView = memo(function TaskForceView({
  force,
  ownerName,
  isMine,
  players,
  selectable,
  selectedShipId,
  onSelectShip,
}: {
  force: TaskForceRow | undefined
  ownerName: string
  isMine: boolean
  players: GamePlayerRow[]
  selectable?: boolean
  selectedShipId?: string | null
  onSelectShip?: (shipId: string) => void
}) {
  if (!force) return null
  // Alive ships first, then sunk - stable within each group so a ship's card keeps its identity
  // (and any in-flight explosion) when it flips from alive to sunk.
  const orderedShips = [...force.ships].sort((a, b) => Number(a.sunk) - Number(b.sunk))

  return (
    <div
      className="ptc-panel ptc-rivets relative overflow-hidden p-3"
      style={isMine ? { borderLeft: '4px solid var(--amber)' } : undefined}
    >
      {force.smoke_active && <div className="ptc-smoke-overlay" />}
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
        {orderedShips.map((s) => (
          <ShipCard
            key={s.shipId}
            ship={s}
            hitPoints={getShip(s.shipId).hitPoints}
            isSelected={selectedShipId === s.shipId}
            onSelect={!s.sunk && selectable ? () => onSelectShip?.(s.shipId) : undefined}
            players={players}
          />
        ))}
        {force.ships.length === 0 && <p className="ptc-mono text-sm text-[var(--ink-soft)]">No ships</p>}
      </div>
    </div>
  )
})

import { useEffect, useRef, useState } from 'react'
import { getShip } from '../lib/cards'
import { CardImage } from './CardImage'
import { ShipTooltip } from './ShipTooltip'
import type { GamePlayerRow, ShipState, TaskForceRow } from '../types/game'

const EXPLOSION_DURATION_MS = 650

/** A live ship card that briefly flashes an explosion overlay whenever its damage increases. */
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
  const [exploding, setExploding] = useState(false)

  useEffect(() => {
    if (ship.damage > prevDamage.current) {
      setExploding(true)
      const t = setTimeout(() => setExploding(false), EXPLOSION_DURATION_MS)
      prevDamage.current = ship.damage
      return () => clearTimeout(t)
    }
    prevDamage.current = ship.damage
  }, [ship.damage])

  return (
    <div className="group relative">
      <CardImage cardId={ship.shipId} size="sm" selected={isSelected} onClick={onSelect} />
      {ship.damage > 0 && (
        <div className="ptc-mono absolute -bottom-1 -right-1 border border-[var(--navy-deep)] bg-[var(--amber)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--navy-deep)]">
          {ship.damage}/{hitPoints}
        </div>
      )}
      {exploding && <div className="ptc-explosion-overlay" />}
      <ShipTooltip ship={ship} players={players} />
    </div>
  )
}

export function TaskForceView({
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
  const aliveShips = force.ships.filter((s) => !s.sunk)
  const sunkShips = force.ships.filter((s) => s.sunk)

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
        {aliveShips.map((s) => (
          <ShipCard
            key={s.shipId}
            ship={s}
            hitPoints={getShip(s.shipId).hitPoints}
            isSelected={selectedShipId === s.shipId}
            onSelect={selectable ? () => onSelectShip?.(s.shipId) : undefined}
            players={players}
          />
        ))}
        {sunkShips.map((s) => (
          <div key={s.shipId} className="group relative w-24 shrink-0" style={{ aspectRatio: '5 / 3' }}>
            <CardImage cardId={s.shipId} size="sm" dim />
            <div
              className="ptc-stamp pointer-events-none absolute inset-x-2 top-1/2 -translate-y-1/2 py-0.5 text-center text-[10px]"
            >
              Sunk
            </div>
            <ShipTooltip ship={s} players={players} />
          </div>
        ))}
        {force.ships.length === 0 && <p className="ptc-mono text-sm text-[var(--ink-soft)]">No ships</p>}
      </div>
    </div>
  )
}

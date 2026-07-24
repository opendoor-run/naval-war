import { memo } from 'react'
import { getShip } from '../lib/cards'
import type { GamePlayerRow, ShipState } from '../types/game'

function nameFor(players: GamePlayerRow[], userId: string): string {
  return players.find((p) => p.user_id === userId)?.display_name ?? 'Unknown'
}

/** Shown on hover over a ship chip - lives inside a `group` + `relative` wrapper. */
export const ShipTooltip = memo(function ShipTooltip({ ship, players }: { ship: ShipState; players: GamePlayerRow[] }) {
  const card = getShip(ship.shipId)
  return (
    <div
      className="ptc-panel pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 p-2.5 text-left opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100"
    >
      <p className="ptc-headline text-sm">
        {card.name}
        {card.isCarrier ? ' (Carrier)' : ''}
      </p>
      <p className="ptc-mono text-[11px] text-[var(--ink-soft)]">
        {card.country}
        {!card.isCarrier && ` · ${card.gunSize}" Guns`}
      </p>
      <p className="ptc-mono mt-1 text-xs font-bold" style={{ color: ship.sunk ? 'var(--red)' : 'var(--navy-deep)' }}>
        {ship.sunk ? `Sunk${ship.sunkBy ? ` by ${nameFor(players, ship.sunkBy)}` : ''}` : `${ship.damage} / ${card.hitPoints} damage`}
      </p>
      {ship.salvos.length > 0 && (
        <div className="ptc-mono mt-1.5 space-y-1 border-t border-dashed border-[var(--parchment-lo)] pt-1.5 text-[10px] text-[var(--ink)]">
          {ship.salvos.map((salvo) => (
            <div key={salvo.id}>
              <div>
                {salvo.gunSize}"-{salvo.damage} salvo — {nameFor(players, salvo.firedBy)}
              </div>
              {salvo.additionalDamage.map((d) => (
                <div key={d.id} className="pl-2 text-[var(--ink-soft)]">
                  +{d.damage} damage — {nameFor(players, d.playedBy)}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
})

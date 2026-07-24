import { useMemo } from 'react'
import { CardImage } from './CardImage'
import { SPECIAL_PHASE_TYPES, getPlayCard, getShip } from '../lib/cards'
import type { TaskForceRow } from '../types/game'

export function Hand({
  cards,
  myForce,
  selectedCardId,
  onSelect,
  specialPhaseMode,
  interactive,
}: {
  cards: string[]
  myForce: TaskForceRow | undefined
  selectedCardId: string | null
  onSelect: (cardId: string | null) => void
  specialPhaseMode: boolean
  interactive: boolean
}) {
  const usableGunSizes = useMemo(
    () => new Set((myForce?.ships ?? []).filter((s) => !s.sunk).map((s) => getShip(s.shipId).gunSize)),
    [myForce]
  )

  // Salvo cards first, ordered by gun size (biggest guns first); everything else keeps its original order after.
  const sortedCards = useMemo(
    () =>
      cards
        .map((cardId, index) => ({ cardId, index }))
        .sort((a, b) => {
          const cardA = getPlayCard(a.cardId)
          const cardB = getPlayCard(b.cardId)
          const salvoA = cardA.type === 'salvo'
          const salvoB = cardB.type === 'salvo'
          if (salvoA && salvoB) return (cardB.gunSize ?? 0) - (cardA.gunSize ?? 0)
          if (salvoA !== salvoB) return salvoA ? -1 : 1
          return a.index - b.index
        })
        .map((c) => c.cardId),
    [cards]
  )

  return (
    <div className="flex flex-wrap items-end gap-2">
      {sortedCards.map((cardId) => {
        const playable = interactive && (!specialPhaseMode || SPECIAL_PHASE_TYPES.has(getPlayCard(cardId).type))
        const card = getPlayCard(cardId)
        const noMatchingGun = card.type === 'salvo' && !usableGunSizes.has(card.gunSize ?? null)
        return (
          <CardImage
            key={cardId}
            cardId={cardId}
            selected={selectedCardId === cardId}
            dim={!playable}
            dimSlight={noMatchingGun}
            onClick={playable ? () => onSelect(selectedCardId === cardId ? null : cardId) : undefined}
          />
        )
      })}
      {cards.length === 0 && <p className="ptc-mono text-sm text-[var(--ink-soft)]">Your hand is empty.</p>}
    </div>
  )
}

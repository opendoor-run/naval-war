import { CardImage } from './CardImage'
import { SPECIAL_PHASE_TYPES, getPlayCard } from '../lib/cards'

export function Hand({
  cards,
  selectedCardId,
  onSelect,
  specialPhaseMode,
  interactive,
}: {
  cards: string[]
  selectedCardId: string | null
  onSelect: (cardId: string | null) => void
  specialPhaseMode: boolean
  interactive: boolean
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {cards.map((cardId) => {
        const playable = interactive && (!specialPhaseMode || SPECIAL_PHASE_TYPES.has(getPlayCard(cardId).type))
        return (
          <CardImage
            key={cardId}
            cardId={cardId}
            selected={selectedCardId === cardId}
            dim={!playable}
            onClick={playable ? () => onSelect(selectedCardId === cardId ? null : cardId) : undefined}
          />
        )
      })}
      {cards.length === 0 && <p className="ptc-mono text-sm text-[var(--ink-soft)]">Your hand is empty.</p>}
    </div>
  )
}

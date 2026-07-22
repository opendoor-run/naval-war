import { CardImage } from './CardImage'
import { SPECIAL_PHASE_TYPES, getPlayCard } from '../lib/cards'

export function Hand({
  cards,
  selectedCardId,
  onSelect,
  specialPhaseMode,
}: {
  cards: string[]
  selectedCardId: string | null
  onSelect: (cardId: string | null) => void
  specialPhaseMode: boolean
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      {cards.map((cardId) => {
        const playable = !specialPhaseMode || SPECIAL_PHASE_TYPES.has(getPlayCard(cardId).type)
        return (
          <CardImage
            key={cardId}
            cardId={cardId}
            selected={selectedCardId === cardId}
            dim={!playable}
            onClick={() => onSelect(selectedCardId === cardId ? null : cardId)}
          />
        )
      })}
      {cards.length === 0 && <p className="text-sm text-white/40">Your hand is empty.</p>}
    </div>
  )
}

import { getShip, getPlayCard, cardImageUrl, CARD_TYPE_LABELS } from '../lib/cards'

function statText(cardId: string): string {
  if (cardId.startsWith('ship-')) {
    const s = getShip(cardId)
    return String(s.hitPoints)
  }
  const p = getPlayCard(cardId)
  if (p.type === 'salvo') return `${p.gunSize}"-${p.damage}`
  if (p.type === 'minefield') return `${p.damage}`
  if (p.type === 'additional_damage') return `+${p.damage}`
  return ''
}

function titleText(cardId: string): string {
  if (cardId.startsWith('ship-')) {
    const s = getShip(cardId)
    return s.isCarrier ? `${s.name} (Carrier)` : s.name
  }
  const p = getPlayCard(cardId)
  return CARD_TYPE_LABELS[p.type]
}

function subText(cardId: string): string {
  if (cardId.startsWith('ship-')) {
    const s = getShip(cardId)
    return s.isCarrier ? s.country : `${s.country} · ${s.gunSize}" Guns`
  }
  const p = getPlayCard(cardId)
  if (p.type === 'salvo') return `${p.gunSize}" Guns`
  return ''
}

export function CardImage({
  cardId,
  selected,
  dim,
  size = 'md',
  onClick,
}: {
  cardId: string
  selected?: boolean
  dim?: boolean
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
}) {
  const dims = { sm: 'w-24', md: 'w-36', lg: 'w-48' }[size]
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative ${dims} shrink-0 overflow-hidden border text-left transition-transform
        border-[var(--navy-deep)] bg-[var(--parchment)]
        ${selected ? '-translate-y-2 shadow-[3px_3px_0_var(--amber)]' : 'shadow-[1px_1px_0_rgba(21,39,56,0.2)]'}
        ${dim ? 'opacity-40' : 'hover:-translate-y-1'}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ aspectRatio: '5 / 3' }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={cardImageUrl(cardId)}
          alt={titleText(cardId)}
          className="h-[125%] w-full object-cover object-center"
          style={{ transform: 'translateY(-8%)', filter: 'grayscale(1) contrast(1.15) sepia(0.15)' }}
          draggable={false}
        />
      </div>
      {statText(cardId) && (
        <div className="ptc-mono absolute left-1 top-1 border border-[var(--navy-deep)] bg-[var(--amber)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--navy-deep)]">
          {statText(cardId)}
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 bg-[var(--navy-deep)] px-1.5 pb-1 pt-1">
        <div className="ptc-mono truncate text-[10px] uppercase leading-tight text-[var(--parchment-hi)]">
          {titleText(cardId)}
        </div>
        {subText(cardId) && (
          <div className="truncate text-[9px] leading-tight text-[var(--parchment-hi)] opacity-70">
            {subText(cardId)}
          </div>
        )}
      </div>
    </button>
  )
}

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
      className={`relative ${dims} shrink-0 overflow-hidden rounded-lg border-2 bg-[#f3ecd8] text-left shadow-md transition-transform
        ${selected ? 'border-amber-400 -translate-y-2 ring-2 ring-amber-300' : 'border-[#c9bd9a]'}
        ${dim ? 'opacity-40 grayscale' : 'hover:-translate-y-1'}
        ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
      style={{ aspectRatio: '5 / 3' }}
    >
      <div className="absolute inset-0 overflow-hidden">
        <img
          src={cardImageUrl(cardId)}
          alt={titleText(cardId)}
          className="h-[125%] w-full object-cover object-center"
          style={{ transform: 'translateY(-8%)' }}
          draggable={false}
        />
      </div>
      <div className="absolute left-1 top-1 rounded bg-black/75 px-1.5 py-0.5 text-xs font-bold text-white">
        {statText(cardId)}
      </div>
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-1.5 pb-1 pt-3">
        <div className="truncate text-[11px] font-semibold leading-tight text-white">{titleText(cardId)}</div>
        {subText(cardId) && <div className="truncate text-[9px] leading-tight text-white/80">{subText(cardId)}</div>}
      </div>
    </button>
  )
}

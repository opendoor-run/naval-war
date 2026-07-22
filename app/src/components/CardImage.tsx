import { getShip, getPlayCard, cardImageUrl, CARD_TYPE_LABELS, CARD_TYPE_DESCRIPTIONS } from '../lib/cards'

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

function playCardSubText(cardId: string): string {
  const p = getPlayCard(cardId)
  if (p.type === 'salvo') return `${p.gunSize}" Guns · ${p.damage} damage`
  if (p.type === 'minefield') return `${p.damage} damage per ship`
  if (p.type === 'additional_damage') return `+${p.damage} damage`
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
  const isPlayCard = cardId.startsWith('play-')
  return (
    <div className={`group relative ${dims} shrink-0`}>
      <button
        type="button"
        onClick={onClick}
        className={`relative block w-full overflow-hidden border text-left transition-transform
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
            style={{ transform: 'translateY(-8%)' }}
            draggable={false}
          />
        </div>
        {statText(cardId) && (
          <div className="ptc-mono absolute left-1 top-1 border border-[var(--navy-deep)] bg-[var(--amber)] px-1 py-0.5 text-[10px] font-bold leading-none text-[var(--navy-deep)]">
            {statText(cardId)}
          </div>
        )}
        {/* Card art already prints the full name/stats - this is just a legibility aid at
            thumbnail size, so it's a thin fading scrim (one line) rather than a solid block. */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 pb-1 pt-3"
          style={{ background: 'linear-gradient(to top, rgba(21,39,56,0.85), transparent)' }}
        >
          <div className="ptc-mono truncate px-1.5 text-[10px] uppercase leading-tight text-[var(--parchment-hi)]">
            {titleText(cardId)}
          </div>
        </div>
      </button>
      {isPlayCard && (
        <div className="ptc-panel pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 w-56 -translate-x-1/2 p-2.5 text-left opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100">
          <p className="ptc-headline text-sm">{titleText(cardId)}</p>
          {playCardSubText(cardId) && (
            <p className="ptc-mono text-[11px] text-[var(--ink-soft)]">{playCardSubText(cardId)}</p>
          )}
          <p className="ptc-mono mt-1 text-xs leading-snug text-[var(--ink)]">
            {CARD_TYPE_DESCRIPTIONS[getPlayCard(cardId).type]}
          </p>
        </div>
      )}
    </div>
  )
}

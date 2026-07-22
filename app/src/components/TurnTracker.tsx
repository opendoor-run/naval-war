import type { DestroyerSquadronRow, GamePlayerRow, GameRow } from '../types/game'

function phaseLabel(game: GameRow, activePlayer: GamePlayerRow | undefined, destroyerSquadrons: DestroyerSquadronRow[]): string | null {
  if (game.status === 'finished') return 'Game Over'
  if (game.status === 'special_phase') return 'Setup Phase'
  if (game.status === 'in_progress') {
    const activeSquadron = activePlayer && destroyerSquadrons.some((s) => s.owner_id === activePlayer.user_id)
    if (activeSquadron) return 'Resolving Destroyer Squadron'
    if (game.pending_drawn_card) return 'Resolving Drawn Card'
    return 'Turn in Progress'
  }
  return null
}

export function TurnTracker({
  game,
  players,
  destroyerSquadrons,
  myUserId,
}: {
  game: GameRow
  players: GamePlayerRow[]
  destroyerSquadrons: DestroyerSquadronRow[]
  myUserId: string
}) {
  const activeSeat =
    game.status === 'special_phase' ? game.special_phase_seat : game.status === 'in_progress' ? game.turn_seat : null
  const activePlayer = players.find((p) => p.seat_index === activeSeat)
  const label = phaseLabel(game, activePlayer, destroyerSquadrons)
  const ordered = players.slice().sort((a, b) => a.seat_index - b.seat_index)

  return (
    <div className="ptc-panel ptc-clipboard ptc-rivets p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="ptc-headline text-sm">Turn Order</p>
        {label && <span className="ptc-stamp px-2 py-0.5 text-[10px]">{label}</span>}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {ordered.map((p) => {
          const isActive = p.seat_index === activeSeat
          return (
            <div
              key={p.user_id}
              className={`ptc-mono flex shrink-0 items-center gap-1 whitespace-nowrap border px-2 py-1 text-xs ${
                isActive
                  ? 'border-[var(--red)] bg-[var(--amber)] font-bold text-[var(--navy-deep)] shadow-[1px_1px_0_var(--navy-deep)]'
                  : 'border-[var(--navy-deep)] bg-[var(--parchment)] text-[var(--navy-deep)]'
              } ${p.is_eliminated_this_round ? 'opacity-50 line-through' : ''}`}
            >
              <span>{p.display_name}</span>
              {p.seat_index === game.dealer_seat && (
                <span title="Dealer" className="text-[9px]">
                  ⚓
                </span>
              )}
              {p.user_id === myUserId && <span className="text-[9px] text-[var(--ink-soft)]">(you)</span>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

import type { GameRow, GamePlayerRow } from '../types/game'

export function ScorePanel({ game, players, myUserId }: { game: GameRow; players: GamePlayerRow[]; myUserId: string }) {
  const sorted = players.slice().sort((a, b) => b.total_score - a.total_score)
  return (
    <div className="ptc-panel ptc-clipboard ptc-rivets p-3">
      <div className="ptc-mono mb-2 flex items-center justify-between text-xs text-[var(--ink-soft)]">
        <span>Round {game.current_round}</span>
        <span>Target {game.target_score}</span>
      </div>
      <ul>
        {sorted.map((p) => {
          const isTurn = game.status === 'in_progress' && game.turn_seat === p.seat_index
          const isSetupTurn = game.status === 'special_phase' && game.special_phase_seat === p.seat_index
          return (
            <li
              key={p.user_id}
              className={`ptc-mono flex items-center gap-2 border-b border-dashed border-[var(--parchment-lo)] px-1 py-1.5 text-sm last:border-b-0 ${
                p.user_id === myUserId ? 'bg-[var(--amber)]/15' : ''
              }`}
            >
              {(isTurn || isSetupTurn) && (
                <span title="Current turn" style={{ color: 'var(--red)' }}>
                  ▶
                </span>
              )}
              <span className={p.is_eliminated_this_round ? 'text-[var(--ink-soft)] line-through' : 'text-[var(--ink)]'}>
                {p.display_name}
              </span>
              {p.seat_index === game.dealer_seat && <span className="text-[10px] text-[var(--ink-soft)]">(dealer)</span>}
              <span className="ml-auto font-bold text-[var(--navy-deep)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {p.total_score}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

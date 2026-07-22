import type { GameRow, GamePlayerRow } from '../types/game'

export function ScorePanel({ game, players, myUserId }: { game: GameRow; players: GamePlayerRow[]; myUserId: string }) {
  const sorted = players.slice().sort((a, b) => b.total_score - a.total_score)
  return (
    <div className="rounded-xl border border-white/15 bg-black/25 p-3">
      <div className="mb-2 flex items-center justify-between text-sm text-white/70">
        <span>Round {game.current_round}</span>
        <span>Target {game.target_score}</span>
      </div>
      <ul className="space-y-1">
        {sorted.map((p) => {
          const isTurn = game.status === 'in_progress' && game.turn_seat === p.seat_index
          const isSetupTurn = game.status === 'special_phase' && game.special_phase_seat === p.seat_index
          return (
            <li
              key={p.user_id}
              className={`flex items-center gap-2 rounded px-2 py-1 text-sm ${
                p.user_id === myUserId ? 'bg-amber-400/10' : ''
              }`}
            >
              {(isTurn || isSetupTurn) && <span title="Current turn">▶</span>}
              <span className={p.is_eliminated_this_round ? 'text-white/40 line-through' : 'text-white'}>
                {p.display_name}
              </span>
              {p.seat_index === game.dealer_seat && <span className="text-[10px] text-white/40">(dealer)</span>}
              <span className="ml-auto font-semibold text-white">{p.total_score}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

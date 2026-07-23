import { useNavigate } from 'react-router-dom'
import { AppHeader } from './AppHeader'
import type { GameRow, GamePlayerRow } from '../types/game'

export function GameOverScreen({ game, players }: { game: GameRow; players: GamePlayerRow[] }) {
  const navigate = useNavigate()
  const sorted = players.slice().sort((a, b) => b.total_score - a.total_score)
  const winner = sorted[0]

  return (
    <div className="command-room min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="ptc-display text-center text-3xl">Game Over</h1>
        {winner && (
          <p className="ptc-mono mb-6 mt-2 text-center text-sm text-[var(--ink-soft)]">
            {winner.display_name} wins with {winner.total_score} points!
          </p>
        )}

        <div className="ptc-panel ptc-clipboard ptc-rivets mb-6 p-5">
          <div className="mb-3 flex items-center justify-between">
            <p className="ptc-headline text-sm">Final Scores</p>
            <span className="ptc-mono text-xs text-[var(--ink-soft)]">
              {game.current_round} round{game.current_round === 1 ? '' : 's'} · target {game.target_score}
            </span>
          </div>
          <ul>
            {sorted.map((p, i) => (
              <li
                key={p.user_id}
                className="ptc-mono flex items-center gap-2 border-b border-dashed border-[var(--parchment-lo)] px-1 py-1.5 text-sm text-[var(--ink)] last:border-b-0"
              >
                <span className="text-[var(--ink-soft)]">#{i + 1}</span>
                <span>{p.display_name}</span>
                {p.is_bot && <span className="ptc-stamp px-1.5 py-0.5 text-[10px]">AI</span>}
                <span className="ml-auto font-bold text-[var(--navy-deep)]" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  {p.total_score}
                </span>
              </li>
            ))}
          </ul>
        </div>

        <button onClick={() => navigate('/')} className="ptc-btn ptc-btn-primary w-full py-2">
          Home
        </button>
      </div>
    </div>
  )
}

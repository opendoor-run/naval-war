import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startGame, deleteGame, gameAction } from '../lib/api'
import { AppHeader } from './AppHeader'
import type { GameRow, GamePlayerRow } from '../types/game'

const InstructionsModal = lazy(() =>
  import('./InstructionsModal').then((m) => ({ default: m.InstructionsModal }))
)

export function Lobby({
  game,
  players,
  isHost,
}: {
  game: GameRow
  players: GamePlayerRow[]
  isHost: boolean
}) {
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [showRules, setShowRules] = useState(false)

  const inviteUrl = `${window.location.origin}/join/${game.invite_token}`

  const copiedTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => {
    return () => clearTimeout(copiedTimeoutRef.current)
  }, [])

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(inviteUrl)
      setCopied(true)
      clearTimeout(copiedTimeoutRef.current)
      copiedTimeoutRef.current = setTimeout(() => setCopied(false), 1500)
    } catch (e) {
      console.error('Lobby: failed to copy invite link', e)
    }
  }

  async function handleStart() {
    setError(null)
    setBusy(true)
    try {
      await startGame(game.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleAddBot() {
    setError(null)
    setBusy(true)
    try {
      await gameAction({ gameId: game.id, type: 'add_bot' })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    setError(null)
    setBusy(true)
    try {
      await deleteGame(game.id)
      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  return (
    <div className="command-room min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="ptc-display text-3xl">Lobby</h1>
        <p className="ptc-mono mb-6 mt-1 text-sm text-[var(--ink-soft)]">
          Target score {game.target_score} · up to {game.max_players} players ·{' '}
          <button onClick={() => setShowRules(true)} className="underline hover:opacity-70">
            Rules
          </button>
        </p>

        <div className="ptc-panel ptc-clipboard ptc-rivets mb-6 p-5">
          <p className="ptc-headline mb-2 text-sm">Invite Link</p>
          <div className="flex gap-2">
            <input
              readOnly
              value={inviteUrl}
              className="ptc-input flex-1 text-sm"
              onFocus={(e) => e.currentTarget.select()}
            />
            <button onClick={copyLink} className="ptc-btn shrink-0 px-3 py-2 text-sm">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>

        <div className="ptc-panel ptc-clipboard ptc-rivets mb-6 p-5">
          <p className="ptc-headline mb-3 text-sm">
            Players ({players.length}/{game.max_players})
          </p>
          <ul className="space-y-1">
            {players.map((p) => (
              <li
                key={p.user_id}
                className="ptc-mono flex items-center gap-2 border-b border-dashed border-[var(--parchment-lo)] px-1 py-1.5 text-sm text-[var(--ink)] last:border-b-0"
              >
                <span className="text-[var(--ink-soft)]">#{p.seat_index + 1}</span>
                <span>{p.display_name}</span>
                {p.is_bot && <span className="ptc-stamp ml-auto px-1.5 py-0.5 text-[10px]">CPU</span>}
                {p.user_id === game.host_id && <span className="ptc-stamp px-1.5 py-0.5 text-[10px]">Host</span>}
              </li>
            ))}
          </ul>
        </div>

        {error && (
          <p className="ptc-mono mb-3 border-2 border-[var(--red)] bg-[var(--parchment-hi)] px-3 py-2 text-sm" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}

        {isHost ? (
          <div className="space-y-3">
            <button
              onClick={handleAddBot}
              disabled={busy || players.length >= game.max_players}
              className="ptc-btn w-full py-2 text-sm"
            >
              Add CPU Opponent
            </button>

            <button onClick={handleStart} disabled={busy || players.length < 3} className="ptc-btn ptc-btn-primary w-full py-2">
              {players.length < 3 ? 'Need at least 3 players' : busy ? 'Starting...' : 'Start Game'}
            </button>

            {confirmingDelete ? (
              <div className="border-2 border-[var(--red)] bg-[var(--parchment-hi)] p-3 text-center">
                <p className="ptc-mono mb-2 text-sm" style={{ color: 'var(--red)' }}>
                  Delete this game for everyone? This can't be undone.
                </p>
                <div className="flex justify-center gap-2">
                  <button onClick={handleDelete} disabled={busy} className="ptc-btn ptc-btn-danger px-4 py-1.5 text-sm">
                    {busy ? 'Deleting...' : 'Yes, Delete It'}
                  </button>
                  <button onClick={() => setConfirmingDelete(false)} disabled={busy} className="ptc-btn px-4 py-1.5 text-sm">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setConfirmingDelete(true)}
                disabled={busy}
                className="ptc-btn w-full py-2 text-sm"
                style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
              >
                Delete Game
              </button>
            )}
          </div>
        ) : (
          <p className="ptc-mono text-center text-sm text-[var(--ink-soft)]">Waiting for the host to start the game...</p>
        )}
      </div>
      {showRules && (
        <Suspense fallback={null}>
          <InstructionsModal onClose={() => setShowRules(false)} />
        </Suspense>
      )}
    </div>
  )
}

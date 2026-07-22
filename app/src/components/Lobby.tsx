import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { startGame, deleteGame } from '../lib/api'
import type { GameRow, GamePlayerRow } from '../types/game'

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

  const inviteUrl = `${window.location.origin}/join/${game.invite_token}`

  async function copyLink() {
    await navigator.clipboard.writeText(inviteUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
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
    <div className="mx-auto max-w-lg px-4 py-12 text-white">
      <h1 className="mb-1 text-3xl font-bold">Lobby</h1>
      <p className="mb-6 text-white/70">
        Target score {game.target_score} · up to {game.max_players} players
      </p>

      <div className="mb-6 rounded-xl border border-white/15 bg-black/25 p-5">
        <p className="mb-2 text-sm font-medium text-white/80">Invite link</p>
        <div className="flex gap-2">
          <input
            readOnly
            value={inviteUrl}
            className="flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white"
            onFocus={(e) => e.currentTarget.select()}
          />
          <button
            onClick={copyLink}
            className="shrink-0 rounded-md bg-white/15 px-3 py-2 text-sm font-medium hover:bg-white/25"
          >
            {copied ? 'Copied!' : 'Copy'}
          </button>
        </div>
      </div>

      <div className="mb-6 rounded-xl border border-white/15 bg-black/25 p-5">
        <p className="mb-3 text-sm font-medium text-white/80">
          Players ({players.length}/{game.max_players})
        </p>
        <ul className="space-y-1">
          {players.map((p) => (
            <li key={p.user_id} className="flex items-center gap-2 rounded bg-white/5 px-3 py-1.5">
              <span className="text-white/50">#{p.seat_index + 1}</span>
              <span>{p.display_name}</span>
              {p.user_id === game.host_id && (
                <span className="ml-auto rounded bg-amber-400/20 px-2 py-0.5 text-xs text-amber-300">Host</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

      {isHost ? (
        <div className="space-y-3">
          <button
            onClick={handleStart}
            disabled={busy || players.length < 3}
            className="w-full rounded-md bg-amber-400 py-2 font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
          >
            {players.length < 3 ? 'Need at least 3 players' : busy ? 'Starting...' : 'Start game'}
          </button>

          {confirmingDelete ? (
            <div className="rounded-md border border-red-400/40 bg-red-950/30 p-3 text-center">
              <p className="mb-2 text-sm text-red-200">Delete this game for everyone? This can't be undone.</p>
              <div className="flex justify-center gap-2">
                <button
                  onClick={handleDelete}
                  disabled={busy}
                  className="rounded-md bg-red-500 px-4 py-1.5 text-sm font-semibold text-white hover:bg-red-400 disabled:opacity-50"
                >
                  {busy ? 'Deleting...' : 'Yes, delete it'}
                </button>
                <button
                  onClick={() => setConfirmingDelete(false)}
                  disabled={busy}
                  className="rounded-md border border-white/20 px-4 py-1.5 text-sm text-white/80 hover:bg-white/10"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmingDelete(true)}
              disabled={busy}
              className="w-full rounded-md border border-red-400/30 py-2 text-sm text-red-300 hover:bg-red-950/30 disabled:opacity-50"
            >
              Delete game
            </button>
          )}
        </div>
      ) : (
        <p className="text-center text-white/60">Waiting for the host to start the game...</p>
      )}
    </div>
  )
}

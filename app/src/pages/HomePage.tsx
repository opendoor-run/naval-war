import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { createGame } from '../lib/api'
import { SignInGate } from '../components/SignInGate'
import { InstructionsModal } from '../components/InstructionsModal'

interface MyGame {
  game_id: string
  status: string
  seat_index: number
}

export default function HomePage() {
  const { user, profile, loading, signInWithPassword, signOut, setDisplayName } = useAuth()
  const navigate = useNavigate()
  const [nameInput, setNameInput] = useState('')
  const [targetScore, setTargetScore] = useState(100)
  const [maxPlayers, setMaxPlayers] = useState(6)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [myGames, setMyGames] = useState<MyGame[]>([])
  const [showInstructions, setShowInstructions] = useState(false)

  useEffect(() => {
    if (profile?.display_name) setNameInput(profile.display_name)
  }, [profile?.display_name])

  useEffect(() => {
    if (!user) return
    supabase
      .from('game_players')
      .select('game_id, seat_index, games(status)')
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (!data) return
        setMyGames(
          data.map((d) => ({
            game_id: d.game_id as string,
            seat_index: d.seat_index as number,
            status: (d as unknown as { games: { status: string } }).games?.status ?? 'lobby',
          }))
        )
      })
  }, [user])

  if (loading) return <Centered>Loading...</Centered>

  if (!user) {
    return (
      <Centered>
        <SignInGate onSignIn={signInWithPassword} />
      </Centered>
    )
  }

  const needsName = !profile?.display_name

  async function handleCreate() {
    setError(null)
    setBusy(true)
    try {
      if (needsName) {
        if (!nameInput.trim()) throw new Error('Enter a display name first')
        await setDisplayName(nameInput.trim())
      }
      const { gameId } = await createGame({
        displayName: nameInput.trim(),
        targetScore,
        maxPlayers,
      })
      navigate(`/game/${gameId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="command-room min-h-screen">
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="ptc-display text-center text-4xl">Naval War</h1>
        <p className="ptc-mono mb-2 mt-2 text-center text-sm text-[var(--ink-soft)]">
          Sink fleets. Score points. First to the target wins.
        </p>
        <p className="ptc-mono mb-8 text-center text-xs text-[var(--ink-soft)]">
          Signed in as {user.email} ·{' '}
          <button onClick={() => void signOut()} className="underline hover:opacity-70">
            Sign out
          </button>
        </p>

        <div className="ptc-panel ptc-clipboard ptc-rivets mb-6 p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="ptc-headline text-sm">Create a Game</h2>
            <button onClick={() => setShowInstructions(true)} className="ptc-btn px-3 py-1 text-xs">
              Instructions
            </button>
          </div>
          <label className="ptc-mono mb-1 block text-xs text-[var(--ink-soft)]">Your display name</label>
          <input
            className="ptc-input mb-4 w-full"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Admiral Nelson"
          />

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="ptc-mono mb-1 block text-xs text-[var(--ink-soft)]">Target score</label>
              <input
                type="number"
                min={10}
                className="ptc-input w-full"
                value={targetScore}
                onChange={(e) => setTargetScore(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="ptc-mono mb-1 block text-xs text-[var(--ink-soft)]">Max players (3-9)</label>
              <input
                type="number"
                min={3}
                max={9}
                className="ptc-input w-full"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
              />
            </div>
          </div>

          {error && (
            <p className="ptc-mono mb-3 border-2 border-[var(--red)] bg-[var(--parchment)] px-3 py-2 text-sm" style={{ color: 'var(--red)' }}>
              {error}
            </p>
          )}

          <button onClick={handleCreate} disabled={busy} className="ptc-btn ptc-btn-primary w-full py-2">
            {busy ? 'Creating...' : 'Create a Game'}
          </button>
        </div>

        {myGames.length > 0 && (
          <div className="ptc-panel ptc-clipboard ptc-rivets p-5">
            <h2 className="ptc-headline mb-3 text-sm">Your Games</h2>
            <ul className="space-y-2">
              {myGames.map((g) => (
                <li key={g.game_id}>
                  <button onClick={() => navigate(`/game/${g.game_id}`)} className="ptc-chip w-full px-3 py-2 text-left text-sm">
                    Game {g.game_id.slice(0, 8)} - <span className="text-[var(--ink-soft)]">{g.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {showInstructions && <InstructionsModal onClose={() => setShowInstructions(false)} />}
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="command-room flex min-h-screen items-center justify-center">{children}</div>
}

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { supabase } from '../lib/supabase'
import { createGame } from '../lib/api'
import { SignInGate } from '../components/SignInGate'

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
    <div className="felt-table min-h-screen text-white">
      <div className="mx-auto max-w-lg px-4 py-12">
        <h1 className="mb-1 text-center text-4xl font-bold tracking-tight">Naval War</h1>
        <p className="mb-2 text-center text-white/70">Sink fleets. Score points. First to the target wins.</p>
        <p className="mb-8 text-center text-xs text-white/40">
          Signed in as {user.email} · <button onClick={() => void signOut()} className="underline hover:text-white/70">Sign out</button>
        </p>

        <div className="mb-6 rounded-xl border border-white/15 bg-black/25 p-5">
          <label className="mb-1 block text-sm font-medium text-white/80">Your display name</label>
          <input
            className="mb-4 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-amber-300"
            value={nameInput}
            onChange={(e) => setNameInput(e.target.value)}
            placeholder="Admiral Nelson"
          />

          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">Target score</label>
              <input
                type="number"
                min={10}
                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white outline-none focus:border-amber-300"
                value={targetScore}
                onChange={(e) => setTargetScore(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-white/80">Max players (3-9)</label>
              <input
                type="number"
                min={3}
                max={9}
                className="w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white outline-none focus:border-amber-300"
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
              />
            </div>
          </div>

          {error && <p className="mb-3 text-sm text-red-300">{error}</p>}

          <button
            onClick={handleCreate}
            disabled={busy}
            className="w-full rounded-md bg-amber-400 py-2 font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
          >
            {busy ? 'Creating...' : 'Create a game'}
          </button>
        </div>

        {myGames.length > 0 && (
          <div className="rounded-xl border border-white/15 bg-black/25 p-5">
            <h2 className="mb-3 text-lg font-semibold">Your games</h2>
            <ul className="space-y-2">
              {myGames.map((g) => (
                <li key={g.game_id}>
                  <button
                    className="w-full rounded-md border border-white/15 bg-white/5 px-3 py-2 text-left hover:bg-white/10"
                    onClick={() => navigate(`/game/${g.game_id}`)}
                  >
                    Game {g.game_id.slice(0, 8)} - <span className="text-white/60">{g.status}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="felt-table flex min-h-screen items-center justify-center text-white">{children}</div>
}

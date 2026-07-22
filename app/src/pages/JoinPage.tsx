import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { joinGame } from '../lib/api'
import { SignInGate } from '../components/SignInGate'

export default function JoinPage() {
  const { token } = useParams<{ token: string }>()
  const { user, profile, loading, signInWithPassword, setDisplayName } = useAuth()
  const navigate = useNavigate()
  const [nameInput, setNameInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.display_name) setNameInput(profile.display_name)
  }, [profile?.display_name])

  if (loading) {
    return (
      <div className="felt-table flex min-h-screen items-center justify-center text-white">Loading...</div>
    )
  }

  if (!user) {
    return (
      <div className="felt-table flex min-h-screen items-center justify-center text-white">
        <SignInGate onSignIn={signInWithPassword} title="Sign in to join" />
      </div>
    )
  }

  async function handleJoin() {
    if (!token) return
    setError(null)
    setBusy(true)
    try {
      if (!nameInput.trim()) throw new Error('Enter a display name first')
      await setDisplayName(nameInput.trim())
      const { gameId } = await joinGame({ inviteToken: token, displayName: nameInput.trim() })
      navigate(`/game/${gameId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="felt-table flex min-h-screen items-center justify-center text-white">
      <div className="w-full max-w-sm rounded-xl border border-white/15 bg-black/25 p-6">
        <h1 className="mb-1 text-2xl font-bold">Join Naval War</h1>
        <p className="mb-4 text-sm text-white/70">Pick a name to join this game.</p>
        <input
          className="mb-4 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-amber-300"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Admiral Nelson"
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />
        {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
        <button
          onClick={handleJoin}
          disabled={busy}
          className="w-full rounded-md bg-amber-400 py-2 font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
        >
          {busy ? 'Joining...' : 'Join game'}
        </button>
      </div>
    </div>
  )
}

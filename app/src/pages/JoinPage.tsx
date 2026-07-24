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
    return <div className="command-room ptc-mono flex min-h-screen items-center justify-center">Loading...</div>
  }

  if (!user) {
    return (
      <div className="command-room flex min-h-screen items-center justify-center">
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
    <div className="command-room flex min-h-screen items-center justify-center">
      <div className="ptc-panel ptc-clipboard ptc-rivets w-full max-w-sm p-6">
        <h1 className="ptc-display text-xl">Join Naval War</h1>
        <p className="ptc-mono mb-4 mt-2 text-sm text-[var(--ink-soft)]">Pick a name to join this game.</p>
        <input
          className="ptc-input mb-4 w-full"
          value={nameInput}
          onChange={(e) => setNameInput(e.target.value)}
          placeholder="Admiral Nelson"
          maxLength={32}
          onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
        />
        {error && (
          <p className="ptc-mono mb-3 border-2 border-[var(--red)] bg-[var(--parchment)] px-3 py-2 text-sm" style={{ color: 'var(--red)' }}>
            {error}
          </p>
        )}
        <button onClick={handleJoin} disabled={busy} className="ptc-btn ptc-btn-primary w-full py-2">
          {busy ? 'Joining...' : 'Join Game'}
        </button>
      </div>
    </div>
  )
}

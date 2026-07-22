import { useState } from 'react'

export function SignInGate({
  onSignIn,
  title = 'Sign in',
}: {
  onSignIn: (email: string, password: string) => Promise<void>
  title?: string
}) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn() {
    if (!email.trim() || !password) return
    setBusy(true)
    setError(null)
    try {
      await onSignIn(email.trim(), password)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="ptc-panel ptc-clipboard ptc-rivets w-full max-w-sm p-6">
      <h1 className="ptc-display text-xl">{title}</h1>
      <p className="ptc-mono mb-4 mt-2 text-sm text-[var(--ink-soft)]">
        This game is invite-only. Use the login and password you were given.
      </p>
      <input
        type="email"
        autoComplete="username"
        className="ptc-input mb-4 w-full"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Login"
        onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
      />
      <input
        type="password"
        autoComplete="current-password"
        className="ptc-input mb-4 w-full"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
      />
      {error && (
        <p className="ptc-mono mb-3 border-2 border-[var(--red)] bg-[var(--parchment)] px-3 py-2 text-sm" style={{ color: 'var(--red)' }}>
          {error}
        </p>
      )}
      <button onClick={handleSignIn} disabled={busy} className="ptc-btn ptc-btn-primary w-full py-2">
        {busy ? 'Signing in...' : 'Sign In'}
      </button>
    </div>
  )
}

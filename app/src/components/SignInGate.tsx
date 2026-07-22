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
    <div className="w-full max-w-sm rounded-xl border border-white/15 bg-black/25 p-6 text-white">
      <h1 className="mb-1 text-xl font-bold">{title}</h1>
      <p className="mb-4 text-sm text-white/70">
        This game is invite-only. Use the login and password you were given.
      </p>
      <input
        type="email"
        autoComplete="username"
        className="mb-3 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-amber-300"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="Login"
        onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
      />
      <input
        type="password"
        autoComplete="current-password"
        className="mb-3 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-amber-300"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Password"
        onKeyDown={(e) => e.key === 'Enter' && handleSignIn()}
      />
      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
      <button
        onClick={handleSignIn}
        disabled={busy}
        className="w-full rounded-md bg-amber-400 py-2 font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
      >
        {busy ? 'Signing in...' : 'Sign in'}
      </button>
    </div>
  )
}

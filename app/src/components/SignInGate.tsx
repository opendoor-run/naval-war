import { useState } from 'react'

export function SignInGate({
  onSendLink,
  title = 'Sign in',
}: {
  onSendLink: (email: string) => Promise<void>
  title?: string
}) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSend() {
    if (!email.trim()) return
    setBusy(true)
    setError(null)
    try {
      await onSendLink(email.trim())
      setSent(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  if (sent) {
    return (
      <div className="w-full max-w-sm rounded-xl border border-white/15 bg-black/25 p-6 text-white">
        <h1 className="mb-2 text-xl font-bold">Check your email</h1>
        <p className="text-sm text-white/70">
          We sent a sign-in link to <span className="text-white">{email}</span>. Open it on this device to
          continue.
        </p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-sm rounded-xl border border-white/15 bg-black/25 p-6 text-white">
      <h1 className="mb-1 text-xl font-bold">{title}</h1>
      <p className="mb-4 text-sm text-white/70">
        This game is invite-only. Enter the email address it was invited under and we'll send you a sign-in
        link.
      </p>
      <input
        type="email"
        className="mb-3 w-full rounded-md border border-white/20 bg-white/10 px-3 py-2 text-white placeholder-white/40 outline-none focus:border-amber-300"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
      />
      {error && <p className="mb-3 text-sm text-red-300">{error}</p>}
      <button
        onClick={handleSend}
        disabled={busy}
        className="w-full rounded-md bg-amber-400 py-2 font-semibold text-black transition hover:bg-amber-300 disabled:opacity-50"
      >
        {busy ? 'Sending...' : 'Send sign-in link'}
      </button>
    </div>
  )
}

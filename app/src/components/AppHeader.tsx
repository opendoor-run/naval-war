import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

/** Slim persistent bar shown on in-game screens (Lobby, GameBoard) - the only way
    back to the home screen or to sign out once you're no longer on HomePage. */
export function AppHeader() {
  const navigate = useNavigate()
  const { signOut } = useAuth()

  async function handleLogout() {
    await signOut()
    navigate('/')
  }

  return (
    <div className="flex items-center justify-between bg-[var(--navy-deep)] px-4 py-1.5">
      <span className="ptc-display text-sm text-[var(--parchment-hi)]">Naval War</span>
      <div className="ptc-mono flex items-center gap-3 text-xs uppercase tracking-wide text-[var(--parchment-hi)]">
        <button onClick={() => navigate('/')} className="hover:opacity-70">
          Home
        </button>
        <span className="opacity-40">|</span>
        <button onClick={() => void handleLogout()} className="hover:opacity-70">
          Logout
        </button>
      </div>
    </div>
  )
}

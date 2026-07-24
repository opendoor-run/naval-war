import { useCallback, useEffect, useState, type ReactNode } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { AuthContext, type Profile } from './useAuth'

/** Runs the auth session/profile subscription once for the whole app. Every in-game screen
    used to call useAuth() independently (AppHeader alone adds a second copy inside
    GameBoard/Lobby/GameOverScreen, all already under GamePage's own call), each paying for
    its own getSession(), profiles query, and onAuthStateChange subscription. Wrap the app in
    this once instead. */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', userId)
      .maybeSingle()
    if (error) console.error('useAuth: failed to load profile', error)
    setProfile(data ?? { id: userId, display_name: null })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (cancelled) return
      setUser(session?.user ?? null)
      if (session?.user) await loadProfile(session.user.id)
      setLoading(false)
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  /** Signs in with an email+password the admin created for this player via the Supabase dashboard. No email is ever sent. */
  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
  }, [])

  const setDisplayName = useCallback(
    async (name: string) => {
      if (!user) return
      const { error } = await supabase
        .from('profiles')
        .upsert({ id: user.id, display_name: name })
      if (!error) setProfile({ id: user.id, display_name: name })
    },
    [user]
  )

  return (
    <AuthContext.Provider value={{ user, profile, loading, signInWithPassword, signOut, setDisplayName }}>
      {children}
    </AuthContext.Provider>
  )
}

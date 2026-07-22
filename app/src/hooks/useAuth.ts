import { useEffect, useState, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

export interface Profile {
  id: string
  display_name: string | null
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name')
      .eq('id', userId)
      .maybeSingle()
    setProfile(data ?? { id: userId, display_name: null })
  }, [])

  useEffect(() => {
    let cancelled = false

    async function init() {
      // supabase-js already parses a magic-link/invite token out of the URL
      // (on the redirect back from the invite email) before this resolves.
      const { data } = await supabase.auth.getSession()
      const session = data.session
      if (cancelled) return
      setUser(session?.user ?? null)
      if (session?.user) await loadProfile(session.user.id)
      setLoading(false)
    }

    init()

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
      if (session?.user) loadProfile(session.user.id)
      else setProfile(null)
    })

    return () => {
      cancelled = true
      sub.subscription.unsubscribe()
    }
  }, [loadProfile])

  /** Sends a passwordless sign-in link. Only works for emails an admin has already invited - new signups are disabled project-wide. */
  const sendSignInLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href },
    })
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

  return { user, profile, loading, sendSignInLink, signOut, setDisplayName }
}

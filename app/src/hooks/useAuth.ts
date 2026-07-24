import { createContext, useContext } from 'react'
import type { User } from '@supabase/supabase-js'

export interface Profile {
  id: string
  display_name: string | null
}

export interface AuthValue {
  user: User | null
  profile: Profile | null
  loading: boolean
  signInWithPassword: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  setDisplayName: (name: string) => Promise<void>
}

export const AuthContext = createContext<AuthValue | null>(null)

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}

import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface OnlinePlayer {
  user_id: string
  display_name: string
}

/** Tracks who's currently online across the whole app via a shared Realtime presence channel.
    Subscribes (and sees others) as soon as there's a signed-in user, independent of whether
    they've set a display name yet - only broadcasting your own presence waits on that. */
export function usePresence(userId: string | undefined, displayName: string | undefined) {
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([])

  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel('online-players', {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState<OnlinePlayer>()
        setOnlinePlayers(Object.values(state).map((entries) => entries[0]))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && displayName) {
          await channel.track({ user_id: userId, display_name: displayName })
        }
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId, displayName])

  return onlinePlayers
}

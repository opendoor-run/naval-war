import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { ChatMessageRow } from '../types/game'

export function useChatMessages(gameId: string | undefined, userId: string | undefined) {
  const [messages, setMessages] = useState<ChatMessageRow[]>([])
  const [sending, setSending] = useState(false)

  useEffect(() => {
    if (!gameId || !userId) return
    let cancelled = false

    supabase
      .from('chat_messages')
      .select('*')
      .eq('game_id', gameId)
      .order('created_at', { ascending: true })
      .limit(200)
      .then(({ data, error }) => {
        if (error) console.error('useChatMessages: failed to load messages', error)
        if (!cancelled && data) setMessages(data as ChatMessageRow[])
      })

    const channel = supabase
      .channel(`chat-${gameId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages', filter: `game_id=eq.${gameId}` },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as ChatMessageRow])
        }
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
    }
  }, [gameId, userId])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!gameId || !userId) return
      const trimmed = text.trim()
      if (!trimmed) return
      setSending(true)
      try {
        const { error } = await supabase
          .from('chat_messages')
          .insert({ game_id: gameId, user_id: userId, message: trimmed })
        if (error) throw error
      } finally {
        setSending(false)
      }
    },
    [gameId, userId]
  )

  return { messages, sendMessage, sending }
}

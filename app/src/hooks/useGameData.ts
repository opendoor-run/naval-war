import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import type {
  GameRow,
  GamePlayerRow,
  HandRow,
  TaskForceRow,
  DestroyerSquadronRow,
  GameLogRow,
} from '../types/game'

export interface GameData {
  game: GameRow | null
  players: GamePlayerRow[]
  myHand: HandRow | null
  taskForces: Record<string, TaskForceRow>
  destroyerSquadrons: DestroyerSquadronRow[]
  log: GameLogRow[]
  loading: boolean
}

export function useGameData(gameId: string | undefined, userId: string | undefined): GameData {
  const [game, setGame] = useState<GameRow | null>(null)
  const [players, setPlayers] = useState<GamePlayerRow[]>([])
  const [myHand, setMyHand] = useState<HandRow | null>(null)
  const [taskForces, setTaskForces] = useState<Record<string, TaskForceRow>>({})
  const [destroyerSquadrons, setDestroyerSquadrons] = useState<DestroyerSquadronRow[]>([])
  const [log, setLog] = useState<GameLogRow[]>([])
  const [loading, setLoading] = useState(true)

  const reloadAll = useCallback(async () => {
    if (!gameId || !userId) return
    const [g, p, h, tf, ds, gl] = await Promise.all([
      supabase.from('games').select('*').eq('id', gameId).maybeSingle(),
      supabase.from('game_players').select('*').eq('game_id', gameId).order('seat_index'),
      supabase.from('hands').select('*').eq('game_id', gameId).eq('user_id', userId).maybeSingle(),
      supabase.from('task_forces').select('*').eq('game_id', gameId),
      supabase.from('destroyer_squadrons').select('*').eq('game_id', gameId),
      supabase.from('game_log').select('*').eq('game_id', gameId).order('created_at', { ascending: false }).limit(50),
    ])
    setGame(g.data as GameRow | null)
    setPlayers((p.data ?? []) as GamePlayerRow[])
    setMyHand(h.data as HandRow | null)
    const tfMap: Record<string, TaskForceRow> = {}
    for (const row of (tf.data ?? []) as TaskForceRow[]) tfMap[row.owner_id] = row
    setTaskForces(tfMap)
    setDestroyerSquadrons((ds.data ?? []) as DestroyerSquadronRow[])
    setLog(((gl.data ?? []) as GameLogRow[]).slice().reverse())
    setLoading(false)
  }, [gameId, userId])

  useEffect(() => {
    reloadAll()
  }, [reloadAll])

  useEffect(() => {
    if (!gameId || !userId) return
    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        setGame(payload.new as GameRow)
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        () => reloadAll()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'hands', filter: `game_id=eq.${gameId}` },
        (payload) => {
          const row = payload.new as HandRow
          if (row?.user_id === userId) setMyHand(row)
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'task_forces', filter: `game_id=eq.${gameId}` },
        (payload) => {
          const row = (payload.new ?? payload.old) as TaskForceRow
          if (!row) return
          setTaskForces((prev) => ({ ...prev, [row.owner_id]: payload.new as TaskForceRow }))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'destroyer_squadrons', filter: `game_id=eq.${gameId}` },
        () => reloadAll()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_log', filter: `game_id=eq.${gameId}` },
        (payload) => {
          const row = payload.new as GameLogRow
          setLog((prev) => (prev.some((e) => e.id === row.id) ? prev : [...prev, row].slice(-50)))
        }
      )
      .subscribe((status) => {
        // Postgres changes missed while the socket was down (tab backgrounded, network
        // blip) never arrive after reconnect - resync from scratch once we're back.
        if (status === 'SUBSCRIBED') reloadAll()
      })

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, userId, reloadAll])

  useEffect(() => {
    function onVisible() {
      if (document.visibilityState === 'visible') reloadAll()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [reloadAll])

  useEffect(() => {
    if (!gameId) return
    // Realtime can silently stall without ever reporting a disconnect, leaving the
    // subscribed INSERT handler above stuck - poll game_log directly as a fallback.
    const interval = setInterval(async () => {
      const { data } = await supabase
        .from('game_log')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (!data) return
      const rows = (data as GameLogRow[]).slice().reverse()
      setLog((prev) => (prev.length === rows.length && prev.at(-1)?.id === rows.at(-1)?.id ? prev : rows))
    }, 8000)
    return () => clearInterval(interval)
  }, [gameId])

  return { game, players, myHand, taskForces, destroyerSquadrons, log, loading }
}

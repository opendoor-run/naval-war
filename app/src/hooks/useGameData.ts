import { useEffect, useState, useCallback, useRef } from 'react'
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
  deleted: boolean
}

export function useGameData(gameId: string | undefined, userId: string | undefined): GameData {
  const [game, setGame] = useState<GameRow | null>(null)
  const [players, setPlayers] = useState<GamePlayerRow[]>([])
  const [myHand, setMyHand] = useState<HandRow | null>(null)
  const [taskForces, setTaskForces] = useState<Record<string, TaskForceRow>>({})
  const [destroyerSquadrons, setDestroyerSquadrons] = useState<DestroyerSquadronRow[]>([])
  const [log, setLog] = useState<GameLogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [deleted, setDeleted] = useState(false)

  const reloadAll = useCallback(async () => {
    if (!gameId || !userId) return
    const [g, p, h, tf, ds, gl] = await Promise.all([
      supabase
        .from('games')
        .select(
          'id, invite_token, host_id, target_score, max_players, status, current_round, dealer_seat, ' +
            'turn_seat, special_phase_seat, version, drawn_this_turn, has_pending_card, draw_count, ' +
            'discard_count, harbor_count, created_at'
        )
        .eq('id', gameId)
        .maybeSingle(),
      supabase.from('game_players').select('*').eq('game_id', gameId).order('seat_index'),
      supabase.from('hands').select('*').eq('game_id', gameId).eq('user_id', userId).maybeSingle(),
      supabase.from('task_forces').select('*').eq('game_id', gameId),
      supabase.from('destroyer_squadrons').select('*').eq('game_id', gameId),
      supabase.from('game_log').select('*').eq('game_id', gameId).order('created_at', { ascending: false }).limit(50),
    ])
    for (const [label, res] of [
      ['games', g],
      ['game_players', p],
      ['hands', h],
      ['task_forces', tf],
      ['destroyer_squadrons', ds],
      ['game_log', gl],
    ] as const) {
      if (res.error) console.error(`useGameData: failed to load ${label}`, res.error)
    }
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
    let hasSubscribedOnce = false
    const channel = supabase
      .channel(`game-${gameId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'games', filter: `id=eq.${gameId}` }, (payload) => {
        if (payload.eventType === 'DELETE') {
          // payload.new is `{}` on delete, not the row - detect it explicitly rather than
          // storing that empty object as if it were a live game.
          setGame(null)
          setDeleted(true)
          return
        }
        setGame(payload.new as GameRow)
      })
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'game_players', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldUserId = (payload.old as Partial<GamePlayerRow>).user_id
            if (!oldUserId) return
            setPlayers((prev) => prev.filter((p) => p.user_id !== oldUserId))
            return
          }
          const row = payload.new as GamePlayerRow
          setPlayers((prev) => {
            const idx = prev.findIndex((p) => p.user_id === row.user_id)
            const next = idx === -1 ? [...prev, row] : prev.map((p, i) => (i === idx ? row : p))
            return next.slice().sort((a, b) => a.seat_index - b.seat_index)
          })
        }
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
          if (payload.eventType === 'DELETE') {
            const ownerId = (payload.old as Partial<TaskForceRow>).owner_id
            if (!ownerId) return
            setTaskForces((prev) => {
              const next = { ...prev }
              delete next[ownerId]
              return next
            })
            return
          }
          const row = payload.new as TaskForceRow
          setTaskForces((prev) => ({ ...prev, [row.owner_id]: row }))
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'destroyer_squadrons', filter: `game_id=eq.${gameId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as Partial<DestroyerSquadronRow>).id
            if (!oldId) return
            setDestroyerSquadrons((prev) => prev.filter((s) => s.id !== oldId))
            return
          }
          const row = payload.new as DestroyerSquadronRow
          setDestroyerSquadrons((prev) => {
            const idx = prev.findIndex((s) => s.id === row.id)
            return idx === -1 ? [...prev, row] : prev.map((s, i) => (i === idx ? row : s))
          })
        }
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
        // blip) never arrive after reconnect - resync from scratch once we're back. Skip
        // the very first SUBSCRIBED (the mount effect below already did the initial load).
        if (status === 'SUBSCRIBED') {
          if (hasSubscribedOnce) reloadAll()
          hasSubscribedOnce = true
        }
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

  // Read inside the poll's stable interval without tearing it down on every game update.
  const gameRef = useRef(game)
  useEffect(() => {
    gameRef.current = game
  }, [game])

  useEffect(() => {
    if (!gameId) return
    // Realtime can silently stall without ever reporting a disconnect, leaving the
    // subscribed INSERT handler above stuck - poll game_log directly as a fallback. Skip
    // the actual request while backgrounded or before/after play, where staleness doesn't
    // matter and the realtime subscription (or the next visibility resync) already covers it.
    const interval = setInterval(async () => {
      if (document.visibilityState !== 'visible') return
      const status = gameRef.current?.status
      if (status === 'lobby' || status === 'finished') return
      const { data } = await supabase
        .from('game_log')
        .select('*')
        .eq('game_id', gameId)
        .order('created_at', { ascending: false })
        .limit(50)
      if (!data) return
      const rows = (data as GameLogRow[]).slice().reverse()
      setLog((prev) => (prev.length === rows.length && prev.at(-1)?.id === rows.at(-1)?.id ? prev : rows))
    }, 20000)
    return () => clearInterval(interval)
  }, [gameId])

  return { game, players, myHand, taskForces, destroyerSquadrons, log, loading, deleted }
}

import { supabase } from './supabase'
import type { GameActionPayload } from '../types/game'

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(fn, { body })
  if (error) {
    let message = error.message
    try {
      const ctx = (error as unknown as { context?: Response }).context
      if (ctx) {
        const json = await ctx.clone().json()
        if (json?.error) message = json.error
      }
    } catch {
      // ignore, fall back to default message
    }
    throw new Error(message)
  }
  return data as T
}

export function createGame(input: { displayName: string; targetScore: number; maxPlayers: number }) {
  return invoke<{ gameId: string; inviteToken: string }>('create-game', input)
}

export function joinGame(input: { inviteToken: string; displayName: string }) {
  return invoke<{ gameId: string }>('join-game', input)
}

export function startGame(gameId: string) {
  return invoke<{ ok: true }>('start-game', { gameId })
}

export function gameAction(payload: GameActionPayload) {
  return invoke<Record<string, unknown>>('game-action', payload as unknown as Record<string, unknown>)
}

import { supabase } from './supabase'
import type { GameActionPayload } from '../types/game'

const INVOKE_TIMEOUT_MS = 15_000

async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), INVOKE_TIMEOUT_MS)
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body, signal: controller.signal })
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
  } catch (e) {
    if (controller.signal.aborted) {
      throw new Error('Request timed out - check your connection and try again.')
    }
    throw e
  } finally {
    clearTimeout(timeout)
  }
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

export function deleteGame(gameId: string) {
  return invoke<{ ok: true }>('delete-game', { gameId })
}

export function gameAction(payload: GameActionPayload) {
  return invoke<Record<string, unknown>>('game-action', payload as unknown as Record<string, unknown>)
}

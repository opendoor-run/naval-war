import { supabase } from './supabase'
import type { GameActionPayload } from '../types/game'

const INVOKE_TIMEOUT_MS = 15_000
const MAX_409_ATTEMPTS = 3

class InvokeError extends Error {
  status?: number
  constructor(message: string, status: number | undefined) {
    super(message)
    this.status = status
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function invokeOnce<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), INVOKE_TIMEOUT_MS)
  try {
    const { data, error } = await supabase.functions.invoke(fn, { body, signal: controller.signal })
    if (error) {
      let message = error.message
      let status: number | undefined
      try {
        const ctx = (error as unknown as { context?: Response }).context
        if (ctx) {
          status = ctx.status
          const json = await ctx.clone().json()
          if (json?.error) message = json.error
        }
      } catch {
        // ignore, fall back to default message
      }
      throw new InvokeError(message, status)
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

/** The optimistic-lock loser gets a 409 when another action landed on the same game first
    (e.g. a concurrent bot turn) - retry a few times with a jittered backoff before giving up,
    rather than making the user notice and click again. */
async function invoke<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  for (let attempt = 1; attempt <= MAX_409_ATTEMPTS; attempt++) {
    try {
      return await invokeOnce<T>(fn, body)
    } catch (e) {
      const status = e instanceof InvokeError ? e.status : undefined
      if (status !== 409 || attempt === MAX_409_ATTEMPTS) throw e
      await sleep(100 + Math.random() * 300)
    }
  }
  throw new Error('unreachable')
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

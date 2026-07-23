import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { HttpError } from './supabaseAdmin.ts'
import type {
  GameRow,
  GamePlayerRow,
  HandRow,
  TaskForceRow,
  DestroyerSquadronRow,
} from './types.ts'

export interface GameContext {
  db: SupabaseClient
  game: GameRow
  players: GamePlayerRow[]
  hands: Map<string, HandRow>
  taskForces: Map<string, TaskForceRow>
  destroyerSquadrons: DestroyerSquadronRow[]
  logEntries: { seat: number | null; message: string }[]
  dirty: {
    game: boolean
    hands: Set<string>
    taskForces: Set<string>
    players: Set<string>
  }
  /** destroyer_squadrons writes (insert/update/delete) don't go through the dirty-row
      pattern above since that table isn't loaded as a single per-owner row - queue them
      here instead so saveContext() awaits them before a handler returns. Queuing (rather
      than writing inline at the call site) matters because chooseBotAction's caller
      reloads a fresh GameContext between every action - an un-awaited write there was a
      real race, letting the next reload see a squadron row that was already resolved. */
  pendingWrites: (() => PromiseLike<{ error: unknown }>)[]
}

export async function loadContext(db: SupabaseClient, gameId: string): Promise<GameContext> {
  const [{ data: game, error: gameErr }, { data: players, error: playersErr }] = await Promise.all([
    db.from('games').select('*').eq('id', gameId).maybeSingle(),
    db.from('game_players').select('*').eq('game_id', gameId).order('seat_index'),
  ])
  if (gameErr) throw gameErr
  if (!game) throw new HttpError(404, 'Game not found')
  if (playersErr) throw playersErr

  const [{ data: hands, error: handsErr }, { data: taskForces, error: tfErr }, { data: squads, error: sqErr }] =
    await Promise.all([
      db.from('hands').select('*').eq('game_id', gameId),
      db.from('task_forces').select('*').eq('game_id', gameId),
      db.from('destroyer_squadrons').select('*').eq('game_id', gameId),
    ])
  if (handsErr) throw handsErr
  if (tfErr) throw tfErr
  if (sqErr) throw sqErr

  return {
    db,
    game: game as GameRow,
    players: (players ?? []) as GamePlayerRow[],
    hands: new Map((hands ?? []).map((h: HandRow) => [h.user_id, h])),
    taskForces: new Map((taskForces ?? []).map((t: TaskForceRow) => [t.owner_id, t])),
    destroyerSquadrons: (squads ?? []) as DestroyerSquadronRow[],
    logEntries: [],
    dirty: { game: false, hands: new Set(), taskForces: new Set(), players: new Set() },
    pendingWrites: [],
  }
}

/** Queue a destroyer_squadrons write to run inside saveContext(), instead of firing it
    off unawaited at the call site (see the GameContext.pendingWrites doc comment). */
export function queueWrite(ctx: GameContext, write: () => PromiseLike<{ error: unknown }>) {
  ctx.pendingWrites.push(write)
}

export function findPlayer(ctx: GameContext, userId: string): GamePlayerRow {
  const p = ctx.players.find((p) => p.user_id === userId)
  if (!p) throw new HttpError(403, 'You are not seated in this game')
  return p
}

export function requireHand(ctx: GameContext, userId: string): HandRow {
  const h = ctx.hands.get(userId)
  if (!h) throw new HttpError(500, 'Missing hand row')
  return h
}

export function requireForce(ctx: GameContext, userId: string) {
  const f = ctx.taskForces.get(userId)
  if (!f) throw new HttpError(500, 'Missing task force row')
  return f
}

export function log(ctx: GameContext, seatIndex: number | null, message: string) {
  ctx.logEntries.push({ seat: seatIndex, message })
}

export function markGameDirty(ctx: GameContext) {
  ctx.dirty.game = true
}
export function markHandDirty(ctx: GameContext, userId: string) {
  ctx.dirty.hands.add(userId)
}
export function markForceDirty(ctx: GameContext, userId: string) {
  ctx.dirty.taskForces.add(userId)
}
export function markPlayerDirty(ctx: GameContext, userId: string) {
  ctx.dirty.players.add(userId)
}

/**
 * Persist all mutated rows. The `games` row update is gated on `version`
 * (compare-and-swap) so two concurrent actions on the same game can't both
 * succeed - the loser gets a 409 and the client can retry.
 */
export async function saveContext(ctx: GameContext) {
  const { db, game } = ctx

  if (ctx.dirty.game) {
    const nextVersion = game.version + 1
    const { data, error } = await db
      .from('games')
      .update({ ...gameUpdatePayload(game), version: nextVersion })
      .eq('id', game.id)
      .eq('version', game.version)
      .select('id')
    if (error) throw error
    if (!data || data.length === 0) {
      throw new HttpError(409, 'Game state changed elsewhere, please retry')
    }
    game.version = nextVersion
  }

  for (const userId of ctx.dirty.hands) {
    const hand = ctx.hands.get(userId)!
    const { error } = await db
      .from('hands')
      .update({ cards: hand.cards })
      .eq('game_id', game.id)
      .eq('user_id', userId)
    if (error) throw error
  }

  for (const userId of ctx.dirty.taskForces) {
    const force = ctx.taskForces.get(userId)!
    const { error } = await db
      .from('task_forces')
      .update({
        ships: force.ships,
        minefields: force.minefields,
        smoke_active: force.smoke_active,
        deep_six: force.deep_six,
      })
      .eq('game_id', game.id)
      .eq('owner_id', userId)
    if (error) throw error
  }

  for (const userId of ctx.dirty.players) {
    const player = ctx.players.find((p) => p.user_id === userId)!
    const { error } = await db
      .from('game_players')
      .update({ total_score: player.total_score, is_eliminated_this_round: player.is_eliminated_this_round })
      .eq('game_id', game.id)
      .eq('user_id', userId)
    if (error) throw error
  }

  if (ctx.logEntries.length > 0) {
    const { error } = await db
      .from('game_log')
      .insert(ctx.logEntries.map((e) => ({ game_id: game.id, seat_index: e.seat, message: e.message })))
    if (error) throw error
  }

  for (const write of ctx.pendingWrites) {
    const result = await write()
    if (result && 'error' in result && result.error) throw result.error
  }
  ctx.pendingWrites = []
}

function gameUpdatePayload(game: GameRow) {
  return {
    status: game.status,
    current_round: game.current_round,
    dealer_seat: game.dealer_seat,
    turn_seat: game.turn_seat,
    special_phase_seat: game.special_phase_seat,
    draw_pile: game.draw_pile,
    discard_pile: game.discard_pile,
    harbor_pile: game.harbor_pile,
    pending_drawn_card: game.pending_drawn_card,
    target_score: game.target_score,
  }
}

export async function savePlayerScores(db: SupabaseClient, gameId: string, players: GamePlayerRow[]) {
  for (const p of players) {
    const { error } = await db
      .from('game_players')
      .update({ total_score: p.total_score, is_eliminated_this_round: p.is_eliminated_this_round })
      .eq('game_id', gameId)
      .eq('user_id', p.user_id)
    if (error) throw error
  }
}

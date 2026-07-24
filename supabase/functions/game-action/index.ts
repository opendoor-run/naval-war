import { adminClient, getCallerId, jsonResponse, errorResponse, corsHeaders, HttpError } from '../_shared/supabaseAdmin.ts'
import { loadContext, type GameContext } from '../_shared/context.ts'
import { dispatchAction } from '../_shared/actions.ts'
import { chooseBotAction } from '../_shared/ai.ts'
import { validateActionPayload } from '../_shared/validation.ts'
import type { GameActionPayload } from '../_shared/types.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

const BOT_DECISION_DELAY_MS = 300

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** After a human action resolves, play out any consecutive bot turns that follow, one action at a time,
    pausing between each so bot moves are readable rather than instant. `initialCtx` is the context the
    caller already loaded and mutated/saved for the human's own action - reused for the first check here
    so an all-human game (the common case) never pays for a second `loadContext`. */
async function runBotTurns(db: SupabaseClient, gameId: string, initialCtx: GameContext) {
  if (!initialCtx.players.some((p) => p.is_bot)) return

  let ctx = initialCtx
  // Generous but finite guard against an unexpected infinite loop in ai.ts.
  for (let i = 0; i < 200; i++) {
    if (i > 0) {
      ctx = await loadContext(db, gameId)
    }
    const g = ctx.game
    const seat = g.status === 'special_phase' ? g.special_phase_seat : g.status === 'in_progress' ? g.turn_seat : null
    if (seat === null) return
    const player = ctx.players.find((p) => p.seat_index === seat)
    if (!player || !player.is_bot || player.is_eliminated_this_round) return

    const action = chooseBotAction(ctx, player.user_id, g.drawn_this_turn)
    if (!action) return

    await sleep(BOT_DECISION_DELAY_MS)
    await dispatchAction(ctx, player.user_id, action)
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const callerId = await getCallerId(req)
    const payload = (await req.json().catch(() => ({}))) as GameActionPayload
    if (!payload.gameId) throw new HttpError(400, 'gameId is required')
    if (!payload.type) throw new HttpError(400, 'type is required')
    validateActionPayload(payload)

    const db = adminClient()
    const ctx = await loadContext(db, payload.gameId)
    const result = await dispatchAction(ctx, callerId, payload)

    // The human action above is already durable at this point. Don't let a failure in the
    // following bot turns (a lost CAS race, a transient error) turn a successful action into
    // an error response - the caller would retry and re-apply an action that already landed.
    try {
      await runBotTurns(db, payload.gameId, ctx)
    } catch (botErr) {
      console.error('Bot turn(s) failed after a successful human action:', botErr)
    }

    return jsonResponse({ ok: true, ...result })
  } catch (err) {
    return errorResponse(err)
  }
})

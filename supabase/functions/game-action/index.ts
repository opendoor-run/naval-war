import { adminClient, getCallerId, jsonResponse, errorResponse, corsHeaders, HttpError } from '../_shared/supabaseAdmin.ts'
import { loadContext } from '../_shared/context.ts'
import { dispatchAction } from '../_shared/actions.ts'
import { chooseBotAction } from '../_shared/ai.ts'
import type { GameActionPayload } from '../_shared/types.ts'
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2'

/** After a human action resolves, play out any consecutive bot turns that follow, one action at a time. */
async function runBotTurns(db: SupabaseClient, gameId: string) {
  let turnState: { seat: number; hasDrawn: boolean } | null = null
  // Generous but finite guard against an unexpected infinite loop in ai.ts.
  for (let i = 0; i < 200; i++) {
    const ctx = await loadContext(db, gameId)
    const g = ctx.game
    const seat = g.status === 'special_phase' ? g.special_phase_seat : g.status === 'in_progress' ? g.turn_seat : null
    if (seat === null) return
    const player = ctx.players.find((p) => p.seat_index === seat)
    if (!player || !player.is_bot || player.is_eliminated_this_round) return

    if (!turnState || turnState.seat !== seat) turnState = { seat, hasDrawn: false }
    const action = chooseBotAction(ctx, player.user_id, turnState.hasDrawn)
    if (!action) return

    const result = (await dispatchAction(ctx, player.user_id, action)) as { resolved?: boolean }
    turnState = action.type === 'draw' && result.resolved === false ? { seat, hasDrawn: true } : null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const callerId = await getCallerId(req)
    const payload = (await req.json().catch(() => ({}))) as GameActionPayload
    if (!payload.gameId) throw new HttpError(400, 'gameId is required')
    if (!payload.type) throw new HttpError(400, 'type is required')

    const db = adminClient()
    const ctx = await loadContext(db, payload.gameId)
    const result = await dispatchAction(ctx, callerId, payload)
    await runBotTurns(db, payload.gameId)

    return jsonResponse({ ok: true, ...result })
  } catch (err) {
    return errorResponse(err)
  }
})

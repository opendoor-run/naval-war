import { adminClient, getCallerId, jsonResponse, errorResponse, corsHeaders, HttpError } from '../_shared/supabaseAdmin.ts'
import { dealNewGame } from '../_shared/engine.ts'
import type { GamePlayerRow } from '../_shared/types.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const callerId = await getCallerId(req)
    const body = await req.json().catch(() => ({}))
    const gameId = String(body.gameId ?? '')
    if (!gameId) throw new HttpError(400, 'gameId is required')

    const db = adminClient()

    const { data: game, error: gameErr } = await db.from('games').select('*').eq('id', gameId).maybeSingle()
    if (gameErr) throw gameErr
    if (!game) throw new HttpError(404, 'Game not found')
    if (game.host_id !== callerId) throw new HttpError(403, 'Only the host can start the game')
    if (game.status !== 'lobby') throw new HttpError(400, 'Game already started')

    const { data: players, error: playersErr } = await db
      .from('game_players')
      .select('*')
      .eq('game_id', gameId)
      .order('seat_index')
    if (playersErr) throw playersErr
    const seated = (players ?? []) as GamePlayerRow[]
    if (seated.length < 3) throw new HttpError(400, 'Need at least 3 players to start')
    if (seated.length > 9) throw new HttpError(400, 'At most 9 players are supported')

    const dealt = dealNewGame(seated)
    const hostSeat = seated.find((p) => p.user_id === callerId)!.seat_index

    // Flip status out of 'lobby' under the version CAS first - that's the lock. A second
    // concurrent start-game call (double-click, or a client retry) will lose this update
    // (0 rows matched) and get a clean 409, instead of silently re-dealing and clobbering
    // every hand a moment after the winner already wrote its own deal.
    const { data: updated, error: updateErr } = await db
      .from('games')
      .update({
        status: 'special_phase',
        dealer_seat: hostSeat,
        special_phase_seat: hostSeat,
        turn_seat: null,
        current_round: 1,
        draw_count: dealt.drawPile.length,
        harbor_count: dealt.harborPile.length,
        discard_count: 0,
        version: game.version + 1,
      })
      .eq('id', gameId)
      .eq('version', game.version)
      .select('id')
    if (updateErr) throw updateErr
    if (!updated || updated.length === 0) {
      throw new HttpError(409, 'Game state changed elsewhere, please retry')
    }

    const { error: secretsErr } = await db
      .from('game_secrets')
      .update({ draw_pile: dealt.drawPile, harbor_pile: dealt.harborPile, discard_pile: [] })
      .eq('game_id', gameId)
    if (secretsErr) throw secretsErr

    for (const p of seated) {
      const { error: handErr } = await db
        .from('hands')
        .update({ cards: dealt.hands[p.user_id] })
        .eq('game_id', gameId)
        .eq('user_id', p.user_id)
      if (handErr) throw handErr

      const { error: forceErr } = await db
        .from('task_forces')
        .update({
          ships: dealt.taskForces[p.user_id],
          minefields: [],
          smoke_active: false,
          deep_six: [],
        })
        .eq('game_id', gameId)
        .eq('owner_id', p.user_id)
      if (forceErr) throw forceErr
    }

    const dealerName = seated.find((p) => p.seat_index === hostSeat)!.display_name
    const { error: logErr } = await db
      .from('game_log')
      .insert({ game_id: gameId, seat_index: hostSeat, message: `Game started. ${dealerName} deals first.` })
    if (logErr) throw logErr

    return jsonResponse({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
})

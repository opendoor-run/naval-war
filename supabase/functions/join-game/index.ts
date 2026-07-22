import { adminClient, getCallerId, jsonResponse, errorResponse, corsHeaders, HttpError } from '../_shared/supabaseAdmin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const callerId = await getCallerId(req)
    const body = await req.json().catch(() => ({}))
    const inviteToken = String(body.inviteToken ?? '').trim()
    const displayName = String(body.displayName ?? '').trim()
    if (!inviteToken) throw new HttpError(400, 'inviteToken is required')
    if (!displayName) throw new HttpError(400, 'displayName is required')

    const db = adminClient()

    const { error: profileErr } = await db
      .from('profiles')
      .upsert({ id: callerId, display_name: displayName })
    if (profileErr) throw profileErr

    const { data: game, error: gameErr } = await db
      .from('games')
      .select('id, status, max_players')
      .eq('invite_token', inviteToken)
      .maybeSingle()
    if (gameErr) throw gameErr
    if (!game) throw new HttpError(404, 'No game found for that invite link')

    const { data: existing, error: existingErr } = await db
      .from('game_players')
      .select('user_id')
      .eq('game_id', game.id)
      .eq('user_id', callerId)
      .maybeSingle()
    if (existingErr) throw existingErr
    if (existing) {
      // Reconnect: already seated.
      return jsonResponse({ gameId: game.id })
    }

    if (game.status !== 'lobby') {
      throw new HttpError(400, 'This game has already started')
    }

    const { count, error: countErr } = await db
      .from('game_players')
      .select('user_id', { count: 'exact', head: true })
      .eq('game_id', game.id)
    if (countErr) throw countErr
    if ((count ?? 0) >= game.max_players) throw new HttpError(400, 'This game is full')

    const { error: playerErr } = await db
      .from('game_players')
      .insert({ game_id: game.id, user_id: callerId, seat_index: count ?? 0, display_name: displayName })
    if (playerErr) throw playerErr

    const { error: handErr } = await db.from('hands').insert({ game_id: game.id, user_id: callerId, cards: [] })
    if (handErr) throw handErr

    const { error: forceErr } = await db
      .from('task_forces')
      .insert({ game_id: game.id, owner_id: callerId, ships: [], minefields: [], smoke_active: false, deep_six: [] })
    if (forceErr) throw forceErr

    return jsonResponse({ gameId: game.id })
  } catch (err) {
    return errorResponse(err)
  }
})

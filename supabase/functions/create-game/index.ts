import { adminClient, getCallerId, jsonResponse, errorResponse, corsHeaders, HttpError } from '../_shared/supabaseAdmin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const callerId = await getCallerId(req)
    const body = await req.json().catch(() => ({}))
    const displayName = String(body.displayName ?? '').trim()
    const targetScore = Number(body.targetScore ?? 100)
    const maxPlayers = Number(body.maxPlayers ?? 6)

    if (!displayName) throw new HttpError(400, 'displayName is required')
    if (maxPlayers < 3 || maxPlayers > 9) throw new HttpError(400, 'maxPlayers must be between 3 and 9')
    if (targetScore < 10) throw new HttpError(400, 'targetScore must be at least 10')

    const db = adminClient()

    const { error: profileErr } = await db
      .from('profiles')
      .upsert({ id: callerId, display_name: displayName })
    if (profileErr) throw profileErr

    const { data: game, error: gameErr } = await db
      .from('games')
      .insert({ host_id: callerId, target_score: targetScore, max_players: maxPlayers })
      .select('*')
      .single()
    if (gameErr) throw gameErr

    const { error: playerErr } = await db
      .from('game_players')
      .insert({ game_id: game.id, user_id: callerId, seat_index: 0, display_name: displayName })
    if (playerErr) throw playerErr

    const { error: handErr } = await db.from('hands').insert({ game_id: game.id, user_id: callerId, cards: [] })
    if (handErr) throw handErr

    const { error: forceErr } = await db
      .from('task_forces')
      .insert({ game_id: game.id, owner_id: callerId, ships: [], minefields: [], smoke_active: false, deep_six: [] })
    if (forceErr) throw forceErr

    return jsonResponse({ gameId: game.id, inviteToken: game.invite_token })
  } catch (err) {
    return errorResponse(err)
  }
})

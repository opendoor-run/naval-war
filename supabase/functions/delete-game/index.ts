import { adminClient, getCallerId, jsonResponse, errorResponse, corsHeaders, HttpError } from '../_shared/supabaseAdmin.ts'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  try {
    const callerId = await getCallerId(req)
    const body = await req.json().catch(() => ({}))
    const gameId = String(body.gameId ?? '')
    if (!gameId) throw new HttpError(400, 'gameId is required')

    const db = adminClient()

    const { data: game, error: gameErr } = await db
      .from('games')
      .select('id, host_id, status')
      .eq('id', gameId)
      .maybeSingle()
    if (gameErr) throw gameErr
    if (!game) throw new HttpError(404, 'Game not found')
    if (game.host_id !== callerId) throw new HttpError(403, 'Only the host can delete this game')
    if (game.status !== 'lobby') {
      throw new HttpError(400, 'Only games still in the lobby can be deleted')
    }

    // All related rows (players, hands, task forces, log, chat) cascade off this delete.
    const { error: deleteErr } = await db.from('games').delete().eq('id', gameId)
    if (deleteErr) throw deleteErr

    return jsonResponse({ ok: true })
  } catch (err) {
    return errorResponse(err)
  }
})

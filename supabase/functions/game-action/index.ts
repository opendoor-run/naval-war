import { adminClient, getCallerId, jsonResponse, errorResponse, corsHeaders, HttpError } from '../_shared/supabaseAdmin.ts'
import { loadContext } from '../_shared/context.ts'
import { dispatchAction } from '../_shared/actions.ts'
import type { GameActionPayload } from '../_shared/types.ts'

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

    return jsonResponse({ ok: true, ...result })
  } catch (err) {
    return errorResponse(err)
  }
})

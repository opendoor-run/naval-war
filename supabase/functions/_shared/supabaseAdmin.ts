import { createClient } from 'jsr:@supabase/supabase-js@2'

export function adminClient() {
  const url = Deno.env.get('SUPABASE_URL')!
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

/** Client scoped to the caller's own JWT, used only to identify who is calling. */
function callerClient(req: Request) {
  const url = Deno.env.get('SUPABASE_URL')!
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const authHeader = req.headers.get('Authorization') ?? ''
  return createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

export async function getCallerId(req: Request): Promise<string> {
  const client = callerClient(req)
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new HttpError(401, 'Not signed in')
  return data.user.id
}

export class HttpError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// Falls back to '*' (today's behavior) until ALLOWED_ORIGIN is set - auth rides in the
// Authorization header rather than a cookie, so this isn't a CSRF vector either way, but
// scoping it to the deployed frontend's origin is cheap defense in depth.
// `supabase secrets set ALLOWED_ORIGIN=https://your-app.vercel.app`
export const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

export function errorResponse(err: unknown) {
  if (err instanceof HttpError) {
    return jsonResponse({ error: err.message }, err.status)
  }
  // Anything that isn't a deliberate HttpError is a bug or a raw DB error (which can carry
  // table/column/constraint names) - log it server-side but never forward its message to
  // the client.
  console.error(err)
  return jsonResponse({ error: 'Internal error' }, 500)
}

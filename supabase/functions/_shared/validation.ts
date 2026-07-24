import { HttpError } from './supabaseAdmin.ts'
import type { ActionType, GameActionPayload } from './types.ts'

const ACTION_TYPES = new Set<ActionType>([
  'draw',
  'play',
  'discard',
  'pass_special',
  'airstrike',
  'resolve_destroyer',
  'add_bot',
])

/** Generic sanity cap on client-supplied arrays - well above any legal hand/fleet size, just
    high enough to reject a deliberately huge payload before it reaches handler code. */
const MAX_ARRAY_LENGTH = 20

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/**
 * Structural validation of the client-supplied action payload, run before dispatch. The
 * payload only ever arrives as `req.json()` cast `as GameActionPayload` in game-action's
 * handler - that cast is not a runtime guarantee, so a malformed shape (wrong type for an
 * array field, a non-array where one is expected) must be rejected here as a clean 400
 * rather than reaching handler code that assumes the shape is correct and throws an
 * uncaught TypeError (e.g. `for...of` over a non-iterable).
 */
export function validateActionPayload(payload: GameActionPayload) {
  if (!ACTION_TYPES.has(payload.type)) {
    throw new HttpError(400, `Unknown action type: ${String(payload.type)}`)
  }

  switch (payload.type) {
    case 'play':
    case 'discard':
      if (!isNonEmptyString(payload.cardId)) throw new HttpError(400, 'cardId is required')
      break

    case 'airstrike': {
      const strikes: unknown = payload.strikes
      if (!Array.isArray(strikes)) throw new HttpError(400, 'strikes must be an array')
      if (strikes.length > MAX_ARRAY_LENGTH) throw new HttpError(400, 'Too many strikes declared')
      for (const s of strikes) {
        if (!isPlainObject(s)) throw new HttpError(400, 'Malformed strike declaration')
        if (
          !isNonEmptyString(s.carrierShipId) ||
          !isNonEmptyString(s.targetOwnerId) ||
          !isNonEmptyString(s.targetShipId)
        ) {
          throw new HttpError(400, 'Malformed strike declaration')
        }
      }
      break
    }

    case 'resolve_destroyer': {
      const r: unknown = payload.destroyerResolution
      if (!isPlainObject(r)) throw new HttpError(400, 'destroyerResolution is required')
      if (!isNonEmptyString(r.targetOwnerId)) throw new HttpError(400, 'destroyerResolution is required')
      const priorityShipIds: unknown = r.priorityShipIds
      if (!Array.isArray(priorityShipIds)) throw new HttpError(400, 'destroyerResolution is required')
      if (priorityShipIds.length > MAX_ARRAY_LENGTH) throw new HttpError(400, 'Too many ships listed')
      for (const id of priorityShipIds) {
        if (!isNonEmptyString(id)) throw new HttpError(400, 'Malformed destroyerResolution')
      }
      break
    }

    default:
      break
  }
}

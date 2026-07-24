// Checks that the two independent copies of the card catalog - the runtime file the client
// bundles (app/src/data/cards.json) and the backend's copy (supabase/functions/_shared/cards.json)
// - agree on every gameplay-relevant field. They're allowed to differ on sheet/row/col (those are
// crop-only metadata the runtime file dropped; see app/src/data/cards-crop.json), but a mismatch
// on anything else (an id, a stat) would mean the client and the rules engine disagree about what
// a card does.
//
// No CI exists in this repo yet - run this manually (`node scripts/verify-cards-sync.mjs` from
// app/) after editing either cards.json, or wire it into CI once one exists.

import { readFileSync } from 'node:fs'
import path from 'node:path'

const root = path.resolve(import.meta.dirname, '..')
const runtimePath = path.join(root, 'src/data/cards.json')
const backendPath = path.resolve(root, '../supabase/functions/_shared/cards.json')

const runtime = JSON.parse(readFileSync(runtimePath, 'utf8'))
const backend = JSON.parse(readFileSync(backendPath, 'utf8'))

const GAMEPLAY_FIELDS = {
  shipDeck: ['id', 'name', 'country', 'gunSize', 'hitPoints', 'isCarrier'],
  playDeck: ['id', 'type', 'gunSize', 'damage'],
}

let ok = true

function pick(obj, fields) {
  const out = {}
  for (const f of fields) out[f] = obj[f] ?? null
  return out
}

for (const [deck, fields] of Object.entries(GAMEPLAY_FIELDS)) {
  const runtimeById = new Map(runtime[deck].map((c) => [c.id, c]))
  const backendById = new Map(backend[deck].map((c) => [c.id, c]))

  for (const id of runtimeById.keys()) {
    if (!backendById.has(id)) {
      ok = false
      console.error(`[${deck}] "${id}" exists in the runtime file but not the backend copy`)
    }
  }
  for (const id of backendById.keys()) {
    if (!runtimeById.has(id)) {
      ok = false
      console.error(`[${deck}] "${id}" exists in the backend copy but not the runtime file`)
    }
  }

  for (const [id, runtimeCard] of runtimeById) {
    const backendCard = backendById.get(id)
    if (!backendCard) continue
    const a = JSON.stringify(pick(runtimeCard, fields))
    const b = JSON.stringify(pick(backendCard, fields))
    if (a !== b) {
      ok = false
      console.error(`[${deck}] "${id}" differs on gameplay fields:\n  runtime: ${a}\n  backend: ${b}`)
    }
  }
}

if (ok) {
  console.log('cards.json is in sync between the client and the backend on every gameplay field.')
  process.exit(0)
} else {
  console.error('\ncards.json has drifted between the client and the backend - see above.')
  process.exit(1)
}

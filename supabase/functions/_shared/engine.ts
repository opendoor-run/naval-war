import { getShip, getPlayCard, allShipIds, allPlayCardIds } from './cards.ts'
import type {
  TaskForceRow,
  ShipState,
  MinefieldState,
  HandRow,
  GamePlayerRow,
} from './types.ts'

// ───────────────────────────────────────────────────────────────────────
// Randomness
// ───────────────────────────────────────────────────────────────────────

export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(secureRandom() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function secureRandom(): number {
  const buf = new Uint32Array(1)
  crypto.getRandomValues(buf)
  return buf[0] / 0x100000000
}

/** Roll a single six-sided die. */
export function rollDie(): number {
  return 1 + Math.floor(secureRandom() * 6)
}

// ───────────────────────────────────────────────────────────────────────
// Setup / dealing
// ───────────────────────────────────────────────────────────────────────

export function dealCountFor(playerCount: number): number {
  return playerCount === 9 ? 4 : 5
}

export interface DealtGame {
  hands: Record<string, string[]>
  taskForces: Record<string, ShipState[]>
  drawPile: string[]
  harborPile: string[]
}

export function dealNewGame(players: GamePlayerRow[]): DealtGame {
  const dealCount = dealCountFor(players.length)
  const shuffledShips = shuffle(allShipIds())
  const shuffledPlay = shuffle(allPlayCardIds())

  const hands: Record<string, string[]> = {}
  const taskForces: Record<string, ShipState[]> = {}

  let shipCursor = 0
  let playCursor = 0

  for (const p of players) {
    const shipCards = shuffledShips.slice(shipCursor, shipCursor + dealCount)
    shipCursor += dealCount
    const playCards = shuffledPlay.slice(playCursor, playCursor + dealCount)
    playCursor += dealCount

    hands[p.user_id] = playCards
    taskForces[p.user_id] = shipCards.map(newShipState)
  }

  return {
    hands,
    taskForces,
    drawPile: shuffledPlay.slice(playCursor),
    harborPile: shuffledShips.slice(shipCursor),
  }
}

export function newShipState(shipId: string): ShipState {
  return { shipId, damage: 0, sunk: false, salvos: [] }
}

export function emptyTaskForce(gameId: string, ownerId: string): TaskForceRow {
  return { game_id: gameId, owner_id: ownerId, ships: [], minefields: [], smoke_active: false, deep_six: [] }
}

// ───────────────────────────────────────────────────────────────────────
// Ship / task-force helpers
// ───────────────────────────────────────────────────────────────────────

export function totalDamage(ship: ShipState): number {
  const salvoDamage = ship.salvos.reduce((sum, s) => sum + s.damage, 0)
  const addDamage = ship.salvos.reduce(
    (sum, s) => sum + s.additionalDamage.reduce((a, d) => a + d.damage, 0),
    0
  )
  return salvoDamage + addDamage
}

/** A carrier can't be targeted until every other (non-sunk) ship in the fleet is sunk. */
export function isTargetable(force: TaskForceRow, shipId: string): boolean {
  const ship = force.ships.find((s) => s.shipId === shipId)
  if (!ship || ship.sunk) return false
  const card = getShip(shipId)
  if (!card.isCarrier) return true
  return force.ships.every((s) => s.shipId === shipId || s.sunk)
}

export function isFleetEliminated(force: TaskForceRow): boolean {
  return force.ships.length > 0 && force.ships.every((s) => s.sunk)
}

/**
 * Apply raw damage to a ship, marking it sunk (and crediting the sinker) if it
 * crosses its hit points. Returns whether this call sank it.
 *
 * Per the rules, "ships you sink go into your Deep Six pile for points" — the
 * sunk ship's card is credited to whoever sank it, not to the fleet it came
 * from. `force` here is always the VICTIM's task force (their ship's `sunk`/
 * `sunkBy` fields live there regardless); `allForces` lets us reach across to
 * the attacker's own task force to push their Deep Six credit there.
 */
function dealDamage(
  force: TaskForceRow,
  shipId: string,
  amount: number,
  sunkBy: string,
  allForces: Map<string, TaskForceRow>
): boolean {
  const ship = force.ships.find((s) => s.shipId === shipId)
  if (!ship || ship.sunk || amount <= 0) return false
  ship.damage += amount
  const card = getShip(shipId)
  if (ship.damage >= card.hitPoints) {
    ship.sunk = true
    ship.sunkBy = sunkBy
    allForces.get(sunkBy)?.deep_six.push(shipId)
    return true
  }
  return false
}

// ───────────────────────────────────────────────────────────────────────
// Card actions
// ───────────────────────────────────────────────────────────────────────

export function fireSalvo(
  force: TaskForceRow,
  shipId: string,
  salvoCardId: string,
  firedBy: string,
  allForces: Map<string, TaskForceRow>
): { sunk: boolean } {
  const card = getPlayCard(salvoCardId)
  if (card.type !== 'salvo') throw new Error('Not a salvo card')
  const ship = force.ships.find((s) => s.shipId === shipId)
  if (!ship) throw new Error('Target ship not in that task force')
  ship.salvos.push({
    id: salvoCardId,
    gunSize: card.gunSize!,
    damage: card.damage!,
    firedBy,
    additionalDamage: [],
  })
  const sunk = dealDamage(force, shipId, card.damage!, firedBy, allForces)
  return { sunk }
}

export function applyAdditionalDamage(
  force: TaskForceRow,
  shipId: string,
  targetSalvoCardId: string,
  damageCardId: string,
  playedBy: string,
  allForces: Map<string, TaskForceRow>
): { sunk: boolean } {
  const dmgCard = getPlayCard(damageCardId)
  if (dmgCard.type !== 'additional_damage') throw new Error('Not an additional damage card')
  const ship = force.ships.find((s) => s.shipId === shipId)
  if (!ship) throw new Error('Target ship not in that task force')
  const salvo = ship.salvos.find((s) => s.id === targetSalvoCardId)
  if (!salvo) throw new Error('That salvo card is not attached to this ship')
  salvo.additionalDamage.push({ id: damageCardId, damage: dmgCard.damage!, playedBy })
  const sunk = dealDamage(force, shipId, dmgCard.damage!, playedBy, allForces)
  return { sunk }
}

/** Removes a salvo stack (and any Additional Damage on it) from a ship. Returns the card ids that should go to the discard pile. */
export function repairShip(force: TaskForceRow, shipId: string, targetSalvoCardId: string): string[] {
  const ship = force.ships.find((s) => s.shipId === shipId)
  if (!ship) throw new Error('Ship not in that task force')
  const idx = ship.salvos.findIndex((s) => s.id === targetSalvoCardId)
  if (idx === -1) throw new Error('That salvo card is not attached to this ship')
  const [removed] = ship.salvos.splice(idx, 1)
  const removedTotal =
    removed.damage + removed.additionalDamage.reduce((a, d) => a + d.damage, 0)
  ship.damage = Math.max(0, ship.damage - removedTotal)
  return [removed.id, ...removed.additionalDamage.map((d) => d.id)]
}

/** Place a minefield on an opponent's force: apply its hits to every current ship immediately. Returns ship ids sunk by this. */
export function placeMinefield(
  force: TaskForceRow,
  minefieldCardId: string,
  placedBy: string,
  allForces: Map<string, TaskForceRow>
): string[] {
  const card = getPlayCard(minefieldCardId)
  if (card.type !== 'minefield') throw new Error('Not a minefield card')
  force.minefields.push({ id: minefieldCardId, damage: card.damage!, placedBy })
  const sunk: string[] = []
  for (const ship of force.ships) {
    if (ship.sunk) continue
    if (dealDamage(force, ship.shipId, card.damage!, placedBy, allForces)) sunk.push(ship.shipId)
  }
  return sunk
}

export function clearMinefields(force: TaskForceRow) {
  force.minefields = []
}

/** Add a ship (Additional Ship card) to a force; it immediately takes any active minefield damage. Returns true if it sank on arrival. */
export function addShipToForce(
  force: TaskForceRow,
  shipId: string,
  allForces: Map<string, TaskForceRow>
): boolean {
  const ship = newShipState(shipId)
  force.ships.push(ship)
  if (force.minefields.length === 0) return false
  const totalMineDamage = force.minefields.reduce((a, m) => a + m.damage, 0)
  const lastMine = force.minefields[force.minefields.length - 1]
  return dealDamage(force, shipId, totalMineDamage, lastMine.placedBy, allForces)
}

/** Submarine (sinks on 5-6) or Torpedo Boat (sinks on 6 only). Roll is supplied by the caller so it can be logged. */
export function resolveRollAttack(
  force: TaskForceRow,
  shipId: string,
  attackType: 'submarine' | 'torpedo_boat',
  roll: number,
  attackedBy: string,
  allForces: Map<string, TaskForceRow>
): { sunk: boolean } {
  const threshold = attackType === 'submarine' ? 5 : 6
  if (roll < threshold) return { sunk: false }
  const ship = force.ships.find((s) => s.shipId === shipId)
  if (!ship) throw new Error('Target ship not in that task force')
  ship.sunk = true
  ship.sunkBy = attackedBy
  allForces.get(attackedBy)?.deep_six.push(shipId)
  return { sunk: true }
}

/** Airstrike: sinks on a roll of 1. */
export function resolveAirstrike(
  force: TaskForceRow,
  shipId: string,
  roll: number,
  attackedBy: string,
  allForces: Map<string, TaskForceRow>
): { sunk: boolean } {
  if (roll !== 1) return { sunk: false }
  const ship = force.ships.find((s) => s.shipId === shipId)
  if (!ship) throw new Error('Target ship not in that task force')
  ship.sunk = true
  ship.sunkBy = attackedBy
  allForces.get(attackedBy)?.deep_six.push(shipId)
  return { sunk: true }
}

/** Destroyer Squadron attack: sinks `count` ships chosen (in priority order) by the owner from the target force. */
export function resolveDestroyerAttack(
  force: TaskForceRow,
  priorityShipIds: string[],
  count: number,
  attackedBy: string,
  allForces: Map<string, TaskForceRow>
): string[] {
  const sunk: string[] = []
  for (const shipId of priorityShipIds) {
    if (sunk.length >= count) break
    const ship = force.ships.find((s) => s.shipId === shipId)
    if (!ship || ship.sunk) continue
    ship.sunk = true
    ship.sunkBy = attackedBy
    allForces.get(attackedBy)?.deep_six.push(shipId)
    sunk.push(shipId)
  }
  return sunk
}

// ───────────────────────────────────────────────────────────────────────
// Turn order
// ───────────────────────────────────────────────────────────────────────

export function nextSeat(
  players: GamePlayerRow[],
  fromSeat: number,
  skipEliminated: boolean
): number | null {
  const seats = players.map((p) => p.seat_index).sort((a, b) => a - b)
  if (seats.length === 0) return null
  const activeSeats = skipEliminated
    ? players.filter((p) => !p.is_eliminated_this_round).map((p) => p.seat_index)
    : seats
  if (activeSeats.length === 0) return null
  const sortedActive = activeSeats.sort((a, b) => a - b)
  const candidates = sortedActive.filter((s) => s > fromSeat)
  return candidates.length > 0 ? candidates[0] : sortedActive[0]
}

export function countActive(players: GamePlayerRow[]): number {
  return players.filter((p) => !p.is_eliminated_this_round).length
}

// ───────────────────────────────────────────────────────────────────────
// Scoring
// ───────────────────────────────────────────────────────────────────────

export interface RoundScoreDelta {
  userId: string
  deepSixPoints: number
  survivorBonus: number
  eliminationPenalty: number
  total: number
}

export function scoreRound(
  players: GamePlayerRow[],
  taskForces: TaskForceRow[]
): RoundScoreDelta[] {
  const forceByOwner = new Map(taskForces.map((f) => [f.owner_id, f]))
  const activeCount = countActive(players)
  const loneSurvivor = activeCount === 1

  return players.map((p) => {
    const force = forceByOwner.get(p.user_id)
    const deepSixPoints = (force?.deep_six ?? []).reduce((sum, shipId) => sum + getShip(shipId).hitPoints, 0)
    const survivorBonus = loneSurvivor && !p.is_eliminated_this_round ? 10 : 0
    const eliminationPenalty = p.is_eliminated_this_round ? -10 : 0
    return {
      userId: p.user_id,
      deepSixPoints,
      survivorBonus,
      eliminationPenalty,
      total: deepSixPoints + survivorBonus + eliminationPenalty,
    }
  })
}

// ───────────────────────────────────────────────────────────────────────
// AI opponent — heuristic move selection.
//
// This module is PURE: given a read-only view of a game (`BotView`) and the
// id of the bot whose turn it is, it returns the single best `GameActionPayload`
// to play right now, or `null` if it isn't the bot's turn. It performs no I/O
// and never mutates the caller's state (it clones task forces before
// simulating moves), so it can be unit-tested in isolation and called
// repeatedly by a server-side loop in `game-action` (one call = one action,
// exactly like a human clicking).
//
// Strategy: a weighted board-evaluation heuristic. `evaluateBoard` scores the
// whole board from the bot's perspective using the WEIGHTS table below; every
// candidate move is scored by the change in board value it produces
// (expected value for die-roll moves), and the highest-scoring legal move
// wins.
//
// SCORING NOTE: "ships you sink go into your Deep Six pile for points" - a
// ship's points are credited to whoever sank it. `bankedPoints` derives this
// from each ship's `sunkBy` field (set by the engine's attack functions)
// rather than reading `deep_six` arrays directly - it comes to the same
// totals as `scoreRound`, but doesn't depend on `deep_six` bookkeeping being
// correct, since `sinkForEval` (used for die-roll expected-value simulation
// below) only ever sets `sunk`/`sunkBy` on a cloned ship, not `deep_six`.
// ───────────────────────────────────────────────────────────────────────

import { getShip, getPlayCard } from './cards.ts'
import * as engine from './engine.ts'
import type {
  GameRow,
  GamePlayerRow,
  HandRow,
  TaskForceRow,
  DestroyerSquadronRow,
  GameActionPayload,
  AirstrikeDeclaration,
} from './types.ts'

/** Fixed bot accounts (seeded in migration 0003_ai_opponent.sql) a host can seat in their lobby. */
export const BOT_PROFILES = [
  { id: 'b0000000-0000-4000-8000-000000000001', name: 'Bot: Halsey' },
  { id: 'b0000000-0000-4000-8000-000000000002', name: 'Bot: Nimitz' },
  { id: 'b0000000-0000-4000-8000-000000000003', name: 'Bot: Yamamoto' },
  { id: 'b0000000-0000-4000-8000-000000000004', name: 'Bot: Doenitz' },
  { id: 'b0000000-0000-4000-8000-000000000005', name: 'Bot: Cunningham' },
]

/** The read-only slice of a GameContext the AI needs. GameContext is
    structurally assignable to this, so the server loop can pass its ctx directly. */
export interface BotView {
  game: GameRow
  players: GamePlayerRow[]
  hands: Map<string, HandRow>
  taskForces: Map<string, TaskForceRow>
  destroyerSquadrons: DestroyerSquadronRow[]
}

// ───────────────────────────────────────────────────────────────────────
// Heuristic weights — "board position" values. All from the bot's own
// perspective; positive is good for the bot. These are deliberately grouped
// and named so they can be tuned in one place.
// ───────────────────────────────────────────────────────────────────────

const WEIGHTS = {
  /** Each hit point of score the bot has banked (ships the bot has sunk). This
      is the literal win condition, so it dominates. */
  ownBankedPoint: 10,
  /** Each hit point an opponent has banked — relative-standing pressure. */
  oppBankedPoint: -4,
  /** Base value of keeping one of the bot's ships afloat (firepower + survival). */
  ownShipAfloat: 6,
  /** Per remaining hit point on the bot's live ships (durability against being finished off). */
  ownEffHpPoint: 0.4,
  /** Extra for a live carrier: repeatable airstrikes, and untargetable until the fleet is otherwise sunk. */
  ownCarrierAfloat: 4,
  /** Per distinct live gun size in the bot's fleet — more salvo cards become playable. */
  ownGunDiversity: 2,
  /** Per own live hit point currently shielded by an active smoke screen (temporary, so modest). */
  smokeProtection: 0.3,
  /** Base elimination-risk penalty, scaled by how close the bot's fleet is to being wiped out. */
  eliminationRiskBase: -40,
  /** Per bot ship sitting at >= half its hit points (likely to be finished off next round). */
  ownShipThreatened: -3,
  /** Per active minefield on the bot's own fleet. */
  enemyMineOnOwn: -2,
  /** Per hit point of damage already dealt on a *targetable* enemy ship — a finish-off opportunity. */
  enemySoftened: 1.5,
  /** Per opponent whose fleet is fully sunk — one fewer rival, closer to the lone-survivor bonus. */
  oppEliminated: 8,
  /** Heuristic value of deploying a Destroyer Squadron (expected future attack, minus that opponents may shoot it down). */
  deploySquadronValue: 6,
  /** Value of drawing a card on a fresh turn — the baseline a fresh-turn airstrike must beat.
      Deliberately high: a single-carrier strike's expected value is ownBankedPoint * hitPoints
      / 6, so at the old value of 5 almost any live ship with 4+ hit points cleared the bar and
      the bot airstruck on nearly every turn it had a carrier. This reserves airstrikes for
      genuinely strong opportunities (a heavy target, multiple carriers, or a finishing blow)
      rather than treating it as the default action. */
  drawBaseline: 11,
}

// Probabilities of a sink for the die-roll attacks.
const P_SUBMARINE = 2 / 6 // sinks on 5 or 6
const P_TORPEDO = 1 / 6 // sinks on 6
const P_AIRSTRIKE = 1 / 6 // sinks on 1

// ───────────────────────────────────────────────────────────────────────
// Board evaluation
// ───────────────────────────────────────────────────────────────────────

function liveShips(force: TaskForceRow) {
  return force.ships.filter((s) => !s.sunk)
}

/** Points banked by `userId` under the documented rules: the hit points of
    every ship anywhere that this player sank. */
function bankedPoints(forces: Map<string, TaskForceRow>, userId: string): number {
  let total = 0
  for (const force of forces.values()) {
    for (const s of force.ships) {
      if (s.sunk && s.sunkBy === userId) total += getShip(s.shipId).hitPoints
    }
  }
  return total
}

/** Weighted board value from the bot's perspective. Higher is better for the bot. */
function evaluateBoard(
  forces: Map<string, TaskForceRow>,
  players: GamePlayerRow[],
  botUserId: string
): number {
  let score = 0

  // Banked score: the win condition (documented rules — the sinker scores).
  score += WEIGHTS.ownBankedPoint * bankedPoints(forces, botUserId)
  for (const p of players) {
    if (p.user_id === botUserId) continue
    score += WEIGHTS.oppBankedPoint * bankedPoints(forces, p.user_id)
  }

  // Own fleet health, firepower, and survival.
  const own = forces.get(botUserId)
  if (own) {
    const live = liveShips(own)
    score += WEIGHTS.ownShipAfloat * live.length

    const gunSizes = new Set<number>()
    for (const s of live) {
      const card = getShip(s.shipId)
      score += WEIGHTS.ownEffHpPoint * Math.max(0, card.hitPoints - s.damage)
      if (card.isCarrier) score += WEIGHTS.ownCarrierAfloat
      if (card.gunSize != null) gunSizes.add(card.gunSize)
      if (card.hitPoints > 0 && s.damage >= card.hitPoints / 2) score += WEIGHTS.ownShipThreatened
    }
    score += WEIGHTS.ownGunDiversity * gunSizes.size
    score += WEIGHTS.enemyMineOnOwn * own.minefields.length

    if (own.smoke_active) {
      const shielded = live.reduce((sum, s) => sum + Math.max(0, getShip(s.shipId).hitPoints - s.damage), 0)
      score += WEIGHTS.smokeProtection * shielded
    }

    // Elimination risk grows sharply as the fleet nears zero live ships.
    if (own.ships.length > 0) {
      if (live.length === 0) score += WEIGHTS.eliminationRiskBase
      else if (live.length === 1) score += WEIGHTS.eliminationRiskBase * 0.35
      else if (live.length === 2) score += WEIGHTS.eliminationRiskBase * 0.12
    }
  }

  // Opponent state: softened targets (opportunity) and eliminated fleets (fewer rivals).
  for (const p of players) {
    if (p.user_id === botUserId) continue
    const force = forces.get(p.user_id)
    if (!force) continue
    if (engine.isFleetEliminated(force)) {
      score += WEIGHTS.oppEliminated
      continue
    }
    for (const s of force.ships) {
      if (!s.sunk && s.damage > 0 && engine.isTargetable(force, s.shipId)) {
        score += WEIGHTS.enemySoftened * s.damage
      }
    }
  }

  return score
}

// ───────────────────────────────────────────────────────────────────────
// Simulation helpers — clone forces, apply a move, re-evaluate.
// ───────────────────────────────────────────────────────────────────────

function cloneForces(forces: Map<string, TaskForceRow>): Map<string, TaskForceRow> {
  const out = new Map<string, TaskForceRow>()
  for (const [k, v] of forces) out.set(k, structuredClone(v))
  return out
}

/** Evaluate the board after applying `mutate` to a throwaway clone of the forces. */
function evalAfter(view: BotView, botUserId: string, mutate: (forces: Map<string, TaskForceRow>) => void): number {
  const forces = cloneForces(view.taskForces)
  mutate(forces)
  return evaluateBoard(forces, view.players, botUserId)
}

/** Directly mark a ship sunk-by-bot on a clone, for the success branch of a die-roll attack. */
function sinkForEval(force: TaskForceRow, shipId: string, botUserId: string) {
  const ship = force.ships.find((s) => s.shipId === shipId)
  if (ship && !ship.sunk) {
    ship.sunk = true
    ship.sunkBy = botUserId
  }
}

interface Candidate {
  payload: GameActionPayload
  score: number
}

function best(candidates: Candidate[]): Candidate | null {
  let top: Candidate | null = null
  for (const c of candidates) {
    if (top === null || c.score > top.score) top = c
  }
  return top
}

// ───────────────────────────────────────────────────────────────────────
// Situational helpers
// ───────────────────────────────────────────────────────────────────────

function livingOpponents(view: BotView, botUserId: string): { ownerId: string; force: TaskForceRow }[] {
  const out: { ownerId: string; force: TaskForceRow }[] = []
  for (const p of view.players) {
    if (p.user_id === botUserId || p.is_eliminated_this_round) continue
    const force = view.taskForces.get(p.user_id)
    if (force) out.push({ ownerId: p.user_id, force })
  }
  return out
}

/** Distinct gun sizes among the bot's live ships (which salvos it can fire). */
function ownLiveGunSizes(view: BotView, botUserId: string): Set<number> {
  const guns = new Set<number>()
  const own = view.taskForces.get(botUserId)
  if (!own) return guns
  for (const s of liveShips(own)) {
    const g = getShip(s.shipId).gunSize
    if (g != null) guns.add(g)
  }
  return guns
}

// ───────────────────────────────────────────────────────────────────────
// Candidate generators for offensive cards
// ───────────────────────────────────────────────────────────────────────

/** Every legal Salvo play from the given card ids (fire at a targetable enemy ship in a non-smoked fleet). */
function salvoCandidates(view: BotView, botUserId: string, cardIds: string[]): Candidate[] {
  const gameId = view.game.id
  const guns = ownLiveGunSizes(view, botUserId)
  const opponents = livingOpponents(view, botUserId)
  const cands: Candidate[] = []
  const before = evaluateBoard(view.taskForces, view.players, botUserId)

  for (const cardId of cardIds) {
    const card = getPlayCard(cardId)
    if (card.type !== 'salvo' || card.gunSize == null) continue
    if (!guns.has(card.gunSize)) continue // no ship with a matching gun
    for (const { ownerId, force } of opponents) {
      if (force.smoke_active) continue
      for (const ship of force.ships) {
        if (!engine.isTargetable(force, ship.shipId)) continue
        const score =
          evalAfter(view, botUserId, (forces) => {
            engine.fireSalvo(forces.get(ownerId)!, ship.shipId, cardId, botUserId, forces)
          }) - before
        cands.push({
          payload: { gameId, type: 'play', cardId, target: { targetOwnerId: ownerId, targetShipId: ship.shipId } },
          score,
        })
      }
    }
  }
  return cands
}

/** Every legal die-roll attack (submarine / torpedo boat), scored at expected value. */
function rollAttackCandidates(
  view: BotView,
  botUserId: string,
  cardId: string,
  type: 'submarine' | 'torpedo_boat'
): Candidate[] {
  const gameId = view.game.id
  const p = type === 'submarine' ? P_SUBMARINE : P_TORPEDO
  const before = evaluateBoard(view.taskForces, view.players, botUserId)
  const cands: Candidate[] = []
  for (const { ownerId, force } of livingOpponents(view, botUserId)) {
    for (const ship of force.ships) {
      if (!engine.isTargetable(force, ship.shipId)) continue
      const afterSink = evalAfter(view, botUserId, (forces) => {
        sinkForEval(forces.get(ownerId)!, ship.shipId, botUserId)
      })
      const expected = before + p * (afterSink - before)
      cands.push({
        payload: { gameId, type: 'play', cardId, target: { targetOwnerId: ownerId, targetShipId: ship.shipId } },
        score: expected - before,
      })
    }
  }
  return cands
}

/** Every legal Additional Damage play (add hits to an enemy ship that already carries a salvo). */
function additionalDamageCandidates(view: BotView, botUserId: string, cardId: string): Candidate[] {
  const gameId = view.game.id
  const before = evaluateBoard(view.taskForces, view.players, botUserId)
  const cands: Candidate[] = []
  for (const { ownerId, force } of livingOpponents(view, botUserId)) {
    for (const ship of force.ships) {
      if (ship.sunk) continue
      for (const salvo of ship.salvos) {
        const score =
          evalAfter(view, botUserId, (forces) => {
            engine.applyAdditionalDamage(forces.get(ownerId)!, ship.shipId, salvo.id, cardId, botUserId, forces)
          }) - before
        cands.push({
          payload: {
            gameId,
            type: 'play',
            cardId,
            target: { targetOwnerId: ownerId, targetShipId: ship.shipId, targetSalvoCardId: salvo.id },
          },
          score,
        })
      }
    }
  }
  return cands
}

/** Every legal Minefield placement (one opponent fleet; during setup, only fleets without a mine already). */
function minefieldCandidates(view: BotView, botUserId: string, cardId: string, setupPhase: boolean): Candidate[] {
  const gameId = view.game.id
  const before = evaluateBoard(view.taskForces, view.players, botUserId)
  const cands: Candidate[] = []
  for (const { ownerId, force } of livingOpponents(view, botUserId)) {
    if (setupPhase && force.minefields.length > 0) continue // one mine per fleet during setup
    const score =
      evalAfter(view, botUserId, (forces) => {
        engine.placeMinefield(forces.get(ownerId)!, cardId, botUserId, forces)
      }) - before
    cands.push({ payload: { gameId, type: 'play', cardId, target: { targetOwnerId: ownerId } }, score })
  }
  return cands
}

/** Additional Ship: add the next harbor ship to the bot's own fleet. */
function additionalShipCandidate(view: BotView, botUserId: string, cardId: string): Candidate | null {
  const nextShip = view.game.harbor_pile[0]
  if (!nextShip) return null
  const before = evaluateBoard(view.taskForces, view.players, botUserId)
  const score =
    evalAfter(view, botUserId, (forces) => {
      const own = forces.get(botUserId)
      if (own) engine.addShipToForce(own, nextShip, forces)
    }) - before
  return { payload: { gameId: view.game.id, type: 'play', cardId }, score }
}

// ───────────────────────────────────────────────────────────────────────
// Candidate generators for defensive / utility cards (bot's own fleet)
// ───────────────────────────────────────────────────────────────────────

function repairCandidates(view: BotView, botUserId: string, cardIds: string[]): Candidate[] {
  const gameId = view.game.id
  const own = view.taskForces.get(botUserId)
  if (!own) return []
  const before = evaluateBoard(view.taskForces, view.players, botUserId)
  const cands: Candidate[] = []
  for (const cardId of cardIds) {
    if (getPlayCard(cardId).type !== 'repair') continue
    for (const ship of own.ships) {
      if (ship.sunk) continue
      for (const salvo of ship.salvos) {
        const score =
          evalAfter(view, botUserId, (forces) => {
            engine.repairShip(forces.get(botUserId)!, ship.shipId, salvo.id)
          }) - before
        cands.push({
          payload: { gameId, type: 'play', cardId, target: { targetShipId: ship.shipId, targetSalvoCardId: salvo.id } },
          score,
        })
      }
    }
  }
  return cands
}

function minesweeperCandidates(view: BotView, botUserId: string, cardIds: string[]): Candidate[] {
  const gameId = view.game.id
  const own = view.taskForces.get(botUserId)
  if (!own || own.minefields.length === 0) return []
  const before = evaluateBoard(view.taskForces, view.players, botUserId)
  const cands: Candidate[] = []
  for (const cardId of cardIds) {
    if (getPlayCard(cardId).type !== 'minesweeper') continue
    const score =
      evalAfter(view, botUserId, (forces) => {
        engine.clearMinefields(forces.get(botUserId)!)
      }) - before
    cands.push({ payload: { gameId, type: 'play', cardId }, score })
  }
  return cands
}

function smokeCandidates(view: BotView, botUserId: string, cardIds: string[]): Candidate[] {
  const gameId = view.game.id
  const own = view.taskForces.get(botUserId)
  if (!own) return []
  const before = evaluateBoard(view.taskForces, view.players, botUserId)
  const cands: Candidate[] = []
  for (const cardId of cardIds) {
    if (getPlayCard(cardId).type !== 'smoke') continue
    if (own.smoke_active) continue
    const score =
      evalAfter(view, botUserId, (forces) => {
        forces.get(botUserId)!.smoke_active = true
      }) - before
    cands.push({ payload: { gameId, type: 'play', cardId }, score })
  }
  return cands
}

function deploySquadronCandidates(view: BotView, botUserId: string, cardIds: string[]): Candidate[] {
  const gameId = view.game.id
  const cands: Candidate[] = []
  for (const cardId of cardIds) {
    if (getPlayCard(cardId).type !== 'destroyer_squadron') continue
    // Squadron isn't part of the force board, so value it with a fixed heuristic
    // (expected future attack), only worthwhile when there are rivals to attack.
    const worthwhile = livingOpponents(view, botUserId).length > 0
    cands.push({ payload: { gameId, type: 'play', cardId }, score: worthwhile ? WEIGHTS.deploySquadronValue : -1 })
  }
  return cands
}

// ───────────────────────────────────────────────────────────────────────
// Airstrike
// ───────────────────────────────────────────────────────────────────────

/** Best airstrike declaration (one strike per live carrier), scored at expected value, or null if unavailable. */
function bestAirstrike(view: BotView, botUserId: string): Candidate | null {
  const own = view.taskForces.get(botUserId)
  if (!own) return null
  const carriers = liveShips(own).filter((s) => getShip(s.shipId).isCarrier)
  if (carriers.length === 0) return null

  const before = evaluateBoard(view.taskForces, view.players, botUserId)

  // Rank every targetable enemy ship by the value of sinking it.
  const targets: { ownerId: string; shipId: string; value: number }[] = []
  for (const { ownerId, force } of livingOpponents(view, botUserId)) {
    for (const ship of force.ships) {
      if (!engine.isTargetable(force, ship.shipId)) continue
      const value =
        evalAfter(view, botUserId, (forces) => sinkForEval(forces.get(ownerId)!, ship.shipId, botUserId)) - before
      targets.push({ ownerId, shipId: ship.shipId, value })
    }
  }
  if (targets.length === 0) return null
  targets.sort((a, b) => b.value - a.value)

  // Assign each carrier a distinct top target (reuse the best if carriers outnumber targets).
  const strikes: AirstrikeDeclaration[] = []
  const hitsPerTarget: number[] = new Array(targets.length).fill(0)
  for (let i = 0; i < carriers.length; i++) {
    const idx = Math.min(i, targets.length - 1)
    hitsPerTarget[idx]++
    strikes.push({ carrierShipId: carriers[i].shipId, targetOwnerId: targets[idx].ownerId, targetShipId: targets[idx].shipId })
  }
  // Two carriers thrown at the same ship don't sink it twice - the shared
  // target's odds compound (1 - miss^hits), rather than summing each
  // carrier's P_AIRSTRIKE independently, which would double-count the value
  // of a single kill and made the bot over-eager to airstrike.
  let expected = 0
  for (let idx = 0; idx < targets.length; idx++) {
    const hits = hitsPerTarget[idx]
    if (hits === 0) continue
    const pAtLeastOneHit = 1 - (1 - P_AIRSTRIKE) ** hits
    expected += pAtLeastOneHit * targets[idx].value
  }
  return { payload: { gameId: view.game.id, type: 'airstrike', strikes }, score: expected }
}

// ───────────────────────────────────────────────────────────────────────
// Destroyer Squadron resolution (bot owns a pending squadron)
// ───────────────────────────────────────────────────────────────────────

function bestDestroyerResolution(view: BotView, botUserId: string): Candidate {
  const gameId = view.game.id
  const before = evaluateBoard(view.taskForces, view.players, botUserId)

  let bestChoice: { ownerId: string; priority: string[]; score: number } | null = null
  for (const { ownerId, force } of livingOpponents(view, botUserId)) {
    // Priority: targetable ships, highest hit points first (bank the most points).
    const priority = force.ships
      .filter((s) => engine.isTargetable(force, s.shipId))
      .sort((a, b) => getShip(b.shipId).hitPoints - getShip(a.shipId).hitPoints)
      .map((s) => s.shipId)
    if (priority.length === 0) continue

    // Expected value over the die: a roll of r sinks the top min(r, available) priority ships.
    let expected = 0
    for (let roll = 1; roll <= 6; roll++) {
      const afterRoll = evalAfter(view, botUserId, (forces) => {
        const f = forces.get(ownerId)!
        for (const shipId of priority.slice(0, roll)) sinkForEval(f, shipId, botUserId)
      })
      expected += afterRoll / 6
    }
    const score = expected - before
    if (bestChoice === null || score > bestChoice.score) bestChoice = { ownerId, priority, score }
  }

  if (bestChoice === null) {
    // No targetable ships anywhere: the attack is still mandatory. Aim at any
    // living opponent (it will simply sink nothing).
    const anyOpp = livingOpponents(view, botUserId)[0]
    const targetOwnerId = anyOpp?.ownerId ?? view.players.find((p) => p.user_id !== botUserId)?.user_id ?? botUserId
    return {
      payload: { gameId, type: 'resolve_destroyer', destroyerResolution: { targetOwnerId, priorityShipIds: [] } },
      score: 0,
    }
  }

  return {
    payload: {
      gameId,
      type: 'resolve_destroyer',
      destroyerResolution: { targetOwnerId: bestChoice.ownerId, priorityShipIds: bestChoice.priority },
    },
    score: bestChoice.score,
  }
}

// ───────────────────────────────────────────────────────────────────────
// Discard fallback (a turn must end; pick the least useful hand card)
// ───────────────────────────────────────────────────────────────────────

/** Rough standalone usefulness of holding a card, for choosing what to discard. */
function cardKeepValue(view: BotView, botUserId: string, cardId: string): number {
  const card = getPlayCard(cardId)
  switch (card.type) {
    case 'salvo':
      // Only useful if the bot can actually fire it.
      return ownLiveGunSizes(view, botUserId).has(card.gunSize ?? -1) ? 3 : 0.5
    case 'repair':
    case 'minesweeper':
    case 'smoke':
    case 'destroyer_squadron':
      return 2
    // Red specials can only ever be resolved when *drawn*, never played from hand
    // in normal play — dead weight in hand, so the best things to pitch.
    case 'minefield':
    case 'submarine':
    case 'torpedo_boat':
    case 'additional_damage':
    case 'additional_ship':
      return 0.1
  }
}

function discardFallback(view: BotView, botUserId: string, hand: string[]): Candidate {
  let worstCard = hand[0]
  let worstValue = Infinity
  for (const cardId of hand) {
    const v = cardKeepValue(view, botUserId, cardId)
    if (v < worstValue) {
      worstValue = v
      worstCard = cardId
    }
  }
  // Slightly negative so any genuinely beneficial play is preferred, but it still
  // beats a harmful play and always provides a legal turn-ending move.
  return { payload: { gameId: view.game.id, type: 'discard', cardId: worstCard }, score: -0.1 }
}

// ───────────────────────────────────────────────────────────────────────
// Phase handlers
// ───────────────────────────────────────────────────────────────────────

/** Setup phase: play a beneficial red special, otherwise pass. */
function chooseSetupAction(view: BotView, botUserId: string, hand: string[]): GameActionPayload {
  const cands: Candidate[] = []
  for (const cardId of hand) {
    const type = getPlayCard(cardId).type
    if (type === 'minefield') cands.push(...minefieldCandidates(view, botUserId, cardId, true))
    else if (type === 'submarine') cands.push(...rollAttackCandidates(view, botUserId, cardId, 'submarine'))
    else if (type === 'torpedo_boat') cands.push(...rollAttackCandidates(view, botUserId, cardId, 'torpedo_boat'))
    else if (type === 'additional_ship') {
      const c = additionalShipCandidate(view, botUserId, cardId)
      if (c) cands.push(c)
    }
    // additional_damage has no legal target during setup (no salvos exist yet) — skip; it's auto-discarded on pass.
  }

  const top = best(cands)
  if (top && top.score > 0) return top.payload
  return { gameId: view.game.id, type: 'pass_special' }
}

/** Normal turn. Order mirrors what the engine requires. */
function chooseNormalTurnAction(
  view: BotView,
  botUserId: string,
  hand: string[],
  hasDrawnThisTurn: boolean
): GameActionPayload {
  const gameId = view.game.id

  // 1. A pending Destroyer Squadron attack must be resolved before anything else.
  if (view.destroyerSquadrons.some((s) => s.owner_id === botUserId)) {
    return bestDestroyerResolution(view, botUserId).payload
  }

  // 2. A just-drawn immediate special must be resolved now.
  if (view.game.pending_drawn_card) {
    return resolvePendingCard(view, botUserId, view.game.pending_drawn_card)
  }

  // 4 (computed early). Every legal terminal play from the current hand — needed
  // both as the eventual fallback and, below, to weigh against an airstrike:
  // drawing doesn't cost the chance to play the best of these, since you draw
  // AND still get to play after, so a strong card already in hand should make
  // the bot draw (and then fire it) rather than airstrike it away unused.
  const cands: Candidate[] = []
  cands.push(...salvoCandidates(view, botUserId, hand))
  cands.push(...repairCandidates(view, botUserId, hand))
  cands.push(...minesweeperCandidates(view, botUserId, hand))
  cands.push(...smokeCandidates(view, botUserId, hand))
  cands.push(...deploySquadronCandidates(view, botUserId, hand))
  const bestHandPlay = best(cands)

  // 3. Fresh turn (haven't drawn yet): an airstrike is the only alternative to
  //    drawing ("instead of drawing, ... launch airstrikes"). Airstrike is NOT
  //    a post-draw option — that would be two actions in one turn — so it must
  //    beat not just the value of a fresh draw but the value of drawing-then-
  //    playing the best card already in hand.
  const drawPossible = view.game.draw_pile.length > 0
  if (!hasDrawnThisTurn) {
    const airstrike = bestAirstrike(view, botUserId)
    const drawValue = WEIGHTS.drawBaseline + Math.max(0, bestHandPlay?.score ?? 0)
    if (drawPossible) {
      if (airstrike && airstrike.score > drawValue) return airstrike.payload
      return { gameId, type: 'draw' }
    }
    // Draw pile empty on a fresh turn (rare — the round usually ends first):
    // take a worthwhile airstrike, otherwise fall through to a terminal play.
    if (airstrike && airstrike.score > 0) return airstrike.payload
  }

  // Turn must end with a play or discard - take the best of the hand plays
  // computed above, plus the discard fallback.
  cands.push(discardFallback(view, botUserId, hand))
  return (best(cands) as Candidate).payload
}

/** Pick the best target for a just-drawn immediate special that must be resolved. */
function resolvePendingCard(view: BotView, botUserId: string, cardId: string): GameActionPayload {
  const type = getPlayCard(cardId).type
  let cands: Candidate[] = []
  if (type === 'minefield') cands = minefieldCandidates(view, botUserId, cardId, false)
  else if (type === 'submarine') cands = rollAttackCandidates(view, botUserId, cardId, 'submarine')
  else if (type === 'torpedo_boat') cands = rollAttackCandidates(view, botUserId, cardId, 'torpedo_boat')
  else if (type === 'additional_damage') cands = additionalDamageCandidates(view, botUserId, cardId)

  const top = best(cands)
  if (top) return top.payload
  // Shouldn't happen — the engine only sets pending_drawn_card when a legal
  // target exists — but fail safe by playing with an empty target.
  return { gameId: view.game.id, type: 'play', cardId, target: {} }
}

// ───────────────────────────────────────────────────────────────────────
// Public entry point
// ───────────────────────────────────────────────────────────────────────

/**
 * Choose the bot's next action, or null if it isn't the bot's turn. Pure: does
 * not mutate `view`. Intended to be called in a loop by `game-action` — after
 * applying the returned action and reloading context, call again until this
 * returns null (the turn has moved off the bot).
 */
export function chooseBotAction(
  view: BotView,
  botUserId: string,
  /** True once the bot has already taken its draw this turn (the loop sets this
      after a normal-card draw that didn't end the turn). Governs whether a
      fresh-turn bot draws/airstrikes or must now play/discard to end its turn. */
  hasDrawnThisTurn = false
): GameActionPayload | null {
  const me = view.players.find((p) => p.user_id === botUserId)
  if (!me) return null
  const seat = me.seat_index
  const hand = view.hands.get(botUserId)?.cards ?? []

  if (view.game.status === 'special_phase') {
    if (view.game.special_phase_seat !== seat) return null
    return chooseSetupAction(view, botUserId, hand)
  }

  if (view.game.status === 'in_progress') {
    if (view.game.turn_seat !== seat) return null
    if (me.is_eliminated_this_round) return null
    return chooseNormalTurnAction(view, botUserId, hand, hasDrawnThisTurn)
  }

  return null
}

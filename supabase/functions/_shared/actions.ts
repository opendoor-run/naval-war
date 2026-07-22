import { getPlayCard, getShip, IMMEDIATE_PLAY_TYPES, SPECIAL_PHASE_TYPES } from './cards.ts'
import * as engine from './engine.ts'
import {
  GameContext,
  findPlayer,
  requireHand,
  requireForce,
  log,
  markGameDirty,
  markHandDirty,
  markForceDirty,
  markPlayerDirty,
  savePlayerScores,
  saveContext,
} from './context.ts'
import { HttpError } from './supabaseAdmin.ts'
import type { GameActionPayload, GamePlayerRow, TaskForceRow } from './types.ts'

function opponentForce(ctx: GameContext, callerId: string, targetOwnerId: string | undefined): TaskForceRow {
  if (!targetOwnerId) throw new HttpError(400, 'A target is required')
  if (targetOwnerId === callerId) throw new HttpError(400, "You can't target your own fleet")
  const force = ctx.taskForces.get(targetOwnerId)
  if (!force) throw new HttpError(400, 'Unknown target player')
  return force
}

function seatOf(ctx: GameContext, userId: string): number {
  return findPlayer(ctx, userId).seat_index
}

function nameOf(ctx: GameContext, userId: string): string {
  return findPlayer(ctx, userId).display_name
}

function shipName(shipId: string): string {
  return getShip(shipId).name
}

/** Checks whether removing/sinking ships eliminated an owner's fleet, and if so, applies elimination consequences. Returns true if the round should end now (all but one eliminated). */
function checkEliminationAndMaybeEndRound(ctx: GameContext, ownerId: string): boolean {
  const force = requireForce(ctx, ownerId)
  if (!engine.isFleetEliminated(force)) return false

  const player = findPlayer(ctx, ownerId)
  if (player.is_eliminated_this_round) return false // already processed

  player.is_eliminated_this_round = true
  markPlayerDirty(ctx, ownerId)
  log(ctx, player.seat_index, `${player.display_name}'s task force is destroyed - eliminated this round.`)

  // Discard their hand face-down.
  const hand = requireHand(ctx, ownerId)
  ctx.game.discard_pile = [...ctx.game.discard_pile, ...hand.cards]
  hand.cards = []
  markHandDirty(ctx, ownerId)
  markGameDirty(ctx)

  // Any pending Destroyer Squadron they own is discarded without attacking.
  const theirSquadrons = ctx.destroyerSquadrons.filter((s) => s.owner_id === ownerId)
  for (const sq of theirSquadrons) {
    ctx.destroyerSquadrons = ctx.destroyerSquadrons.filter((s) => s.id !== sq.id)
    ctx.game.discard_pile = [...ctx.game.discard_pile, sq.card_id]
    void ctx.db.from('destroyer_squadrons').delete().eq('id', sq.id)
  }

  return engine.countActive(ctx.players) === 1
}

// ───────────────────────────────────────────────────────────────────────
// draw
// ───────────────────────────────────────────────────────────────────────

async function handleDraw(ctx: GameContext, callerId: string) {
  const game = ctx.game
  if (game.status !== 'in_progress') throw new HttpError(400, 'Not in normal play')
  const seat = seatOf(ctx, callerId)
  if (game.turn_seat !== seat) throw new HttpError(403, "It's not your turn")
  if (game.pending_drawn_card) throw new HttpError(400, 'Resolve your drawn card first')
  if (ctx.destroyerSquadrons.some((s) => s.owner_id === callerId)) {
    throw new HttpError(400, 'Resolve your Destroyer Squadron attack first')
  }
  if (game.draw_pile.length === 0) throw new HttpError(400, 'The draw pile is empty')

  const [cardId, ...rest] = game.draw_pile
  game.draw_pile = rest
  markGameDirty(ctx)

  const card = getPlayCard(cardId)

  if (card.type === 'additional_ship') {
    game.discard_pile = [...game.discard_pile, cardId]
    resolveAdditionalShip(ctx, callerId)
    log(ctx, seat, `${nameOf(ctx, callerId)} drew and played Additional Ship.`)
    await finishTurnAction(ctx)
    return { drawnCard: cardId, resolved: true }
  }

  if (IMMEDIATE_PLAY_TYPES.has(card.type)) {
    const legal = hasAnyLegalTarget(ctx, callerId, card.type)
    if (!legal) {
      game.discard_pile = [...game.discard_pile, cardId]
      log(ctx, seat, `${nameOf(ctx, callerId)} drew ${describeCard(cardId)} but had no legal target - discarded.`)
      await finishTurnAction(ctx)
      return { drawnCard: cardId, resolved: true, discardedNoTarget: true }
    }
    game.pending_drawn_card = cardId
    log(ctx, seat, `${nameOf(ctx, callerId)} drew ${describeCard(cardId)} - must resolve it now.`)
    await ctxSaveOnly(ctx)
    return { drawnCard: cardId, resolved: false }
  }

  // Normal card: goes into hand, turn is NOT over yet - player still acts.
  const hand = requireHand(ctx, callerId)
  hand.cards = [...hand.cards, cardId]
  markHandDirty(ctx, callerId)
  log(ctx, seat, `${nameOf(ctx, callerId)} drew a card.`)
  await ctxSaveOnly(ctx)
  return { drawnCard: cardId, resolved: false }
}

function hasAnyLegalTarget(ctx: GameContext, callerId: string, type: string): boolean {
  const opponents = ctx.players.filter((p) => p.user_id !== callerId && !p.is_eliminated_this_round)
  if (type === 'minefield') return opponents.length > 0
  if (type === 'submarine' || type === 'torpedo_boat') {
    return opponents.some((o) => {
      const force = requireForce(ctx, o.user_id)
      return force.ships.some((s) => engine.isTargetable(force, s.shipId))
    })
  }
  if (type === 'additional_damage') {
    return opponents.some((o) => {
      const force = requireForce(ctx, o.user_id)
      return force.ships.some((s) => !s.sunk && s.salvos.length > 0)
    })
  }
  return true
}

function resolveAdditionalShip(ctx: GameContext, callerId: string) {
  const game = ctx.game
  if (game.harbor_pile.length === 0) {
    log(ctx, seatOf(ctx, callerId), `${nameOf(ctx, callerId)} tried Additional Ship, but the harbor is empty.`)
    return
  }
  const [shipId, ...rest] = game.harbor_pile
  game.harbor_pile = rest
  markGameDirty(ctx)
  const force = requireForce(ctx, callerId)
  const minelayer = force.minefields[force.minefields.length - 1]?.placedBy
  const sunkOnArrival = engine.addShipToForce(force, shipId, ctx.taskForces)
  markForceDirty(ctx, callerId)
  // Sunk on arrival credits the minelayer's Deep Six, not the receiving player's - their force needs saving too.
  if (sunkOnArrival && minelayer) markForceDirty(ctx, minelayer)
  log(
    ctx,
    seatOf(ctx, callerId),
    `${nameOf(ctx, callerId)} added ${shipName(shipId)} to their task force` +
      (sunkOnArrival ? ' - sunk immediately by an active minefield!' : '.')
  )
  if (sunkOnArrival) checkEliminationAndMaybeEndRound(ctx, callerId)
}

function describeCard(cardId: string): string {
  const c = getPlayCard(cardId)
  switch (c.type) {
    case 'salvo':
      return `a ${c.gunSize}" Salvo (${c.damage} hits)`
    case 'minefield':
      return `a Minefield (${c.damage} hit${c.damage === 2 ? 's' : ''})`
    case 'additional_damage':
      return `Additional Damage (+${c.damage})`
    default:
      return c.type.replace('_', ' ')
  }
}

// ───────────────────────────────────────────────────────────────────────
// play (hand card, or resolving a pending drawn special card)
// ───────────────────────────────────────────────────────────────────────

async function handlePlay(ctx: GameContext, callerId: string, payload: GameActionPayload) {
  const game = ctx.game
  const seat = seatOf(ctx, callerId)
  const cardId = payload.cardId
  if (!cardId) throw new HttpError(400, 'cardId is required')
  const card = getPlayCard(cardId)

  if (game.pending_drawn_card) {
    if (game.pending_drawn_card !== cardId) {
      throw new HttpError(400, 'You must resolve the card you just drew first')
    }
    if (game.turn_seat !== seat || game.status !== 'in_progress') {
      throw new HttpError(403, "It's not your turn")
    }
    game.pending_drawn_card = null
    markGameDirty(ctx)
    applyCardEffect(ctx, callerId, cardId, payload)
    await finishTurnAction(ctx)
    return { resolved: true }
  }

  if (game.status === 'special_phase') {
    if (game.special_phase_seat !== seat) throw new HttpError(403, 'Not your setup turn')
    if (!SPECIAL_PHASE_TYPES.has(card.type)) {
      throw new HttpError(400, 'Only red special cards can be played during setup')
    }
    const hand = requireHand(ctx, callerId)
    if (!hand.cards.includes(cardId)) throw new HttpError(400, "That card isn't in your hand")
    if (card.type === 'minefield') {
      const force = opponentForce(ctx, callerId, payload.target?.targetOwnerId)
      if (force.minefields.length > 0) {
        throw new HttpError(400, 'Only one Minefield per fleet is allowed during setup')
      }
    }
    hand.cards = hand.cards.filter((c) => c !== cardId)
    markHandDirty(ctx, callerId)
    applyCardEffect(ctx, callerId, cardId, payload)
    // Rare, but a mine/submarine/torpedo played during setup could eliminate
    // a fleet outright - check even though normal turns haven't begun yet.
    if (!(await maybeEndRoundOnly(ctx))) {
      await ctxSaveOnly(ctx)
    }
    return { resolved: true, endedTurn: false }
  }

  if (game.status !== 'in_progress') throw new HttpError(400, 'Game is not in normal play')
  if (game.turn_seat !== seat) throw new HttpError(403, "It's not your turn")
  if (SPECIAL_PHASE_TYPES.has(card.type)) {
    throw new HttpError(400, 'That card must be resolved immediately when drawn, not played from hand')
  }
  const hand = requireHand(ctx, callerId)
  if (!hand.cards.includes(cardId)) throw new HttpError(400, "That card isn't in your hand")
  hand.cards = hand.cards.filter((c) => c !== cardId)
  markHandDirty(ctx, callerId)
  applyCardEffect(ctx, callerId, cardId, payload)
  await finishTurnAction(ctx)
  return { resolved: true }
}

function applyCardEffect(ctx: GameContext, callerId: string, cardId: string, payload: GameActionPayload) {
  const card = getPlayCard(cardId)
  const seat = seatOf(ctx, callerId)
  const target = payload.target ?? {}

  switch (card.type) {
    case 'salvo': {
      if (target.targetDestroyerSquadronId) {
        applySalvoToDestroyerSquadron(ctx, callerId, cardId, target.targetDestroyerSquadronId)
        return
      }
      const force = opponentForce(ctx, callerId, target.targetOwnerId)
      if (!target.targetShipId) throw new HttpError(400, 'targetShipId is required')
      if (force.smoke_active) throw new HttpError(400, 'That fleet is hidden by smoke')
      if (!engine.isTargetable(force, target.targetShipId)) {
        throw new HttpError(400, 'That ship cannot be targeted right now')
      }
      const myForce = requireForce(ctx, callerId)
      const ownsMatchingGun = myForce.ships.some(
        (s) => !s.sunk && getShip(s.shipId).gunSize === card.gunSize
      )
      if (!ownsMatchingGun) throw new HttpError(400, `You have no ${card.gunSize}" ship to fire this Salvo`)
      const { sunk } = engine.fireSalvo(force, target.targetShipId, cardId, callerId, ctx.taskForces)
      markForceDirty(ctx, target.targetOwnerId!)
      if (sunk) markForceDirty(ctx, callerId) // Deep Six credit lands on the bot's/player's own force
      log(
        ctx,
        seat,
        `${nameOf(ctx, callerId)} fired a ${card.gunSize}" Salvo at ${shipName(target.targetShipId)}` +
          (sunk ? ' - sunk!' : '.')
      )
      if (sunk) checkEliminationAndMaybeEndRound(ctx, target.targetOwnerId!)
      return
    }
    case 'additional_damage': {
      const force = opponentForce(ctx, callerId, target.targetOwnerId)
      if (!target.targetShipId || !target.targetSalvoCardId) {
        throw new HttpError(400, 'targetShipId and targetSalvoCardId are required')
      }
      const { sunk } = engine.applyAdditionalDamage(
        force,
        target.targetShipId,
        target.targetSalvoCardId,
        cardId,
        callerId,
        ctx.taskForces
      )
      markForceDirty(ctx, target.targetOwnerId!)
      if (sunk) markForceDirty(ctx, callerId)
      log(
        ctx,
        seat,
        `${nameOf(ctx, callerId)} added damage to ${shipName(target.targetShipId)}` + (sunk ? ' - sunk!' : '.')
      )
      if (sunk) checkEliminationAndMaybeEndRound(ctx, target.targetOwnerId!)
      return
    }
    case 'minefield': {
      const force = opponentForce(ctx, callerId, target.targetOwnerId)
      const sunkIds = engine.placeMinefield(force, cardId, callerId, ctx.taskForces)
      markForceDirty(ctx, target.targetOwnerId!)
      if (sunkIds.length > 0) markForceDirty(ctx, callerId)
      log(
        ctx,
        seat,
        `${nameOf(ctx, callerId)} laid a minefield in front of ${nameOf(ctx, target.targetOwnerId!)}'s fleet` +
          (sunkIds.length > 0 ? ` - sank ${sunkIds.map(shipName).join(', ')}!` : '.')
      )
      if (sunkIds.length > 0) checkEliminationAndMaybeEndRound(ctx, target.targetOwnerId!)
      return
    }
    case 'submarine':
    case 'torpedo_boat': {
      const force = opponentForce(ctx, callerId, target.targetOwnerId)
      if (!target.targetShipId) throw new HttpError(400, 'targetShipId is required')
      if (!engine.isTargetable(force, target.targetShipId)) {
        throw new HttpError(400, 'That ship cannot be targeted right now')
      }
      const roll = engine.rollDie()
      const { sunk } = engine.resolveRollAttack(force, target.targetShipId, card.type, roll, callerId, ctx.taskForces)
      markForceDirty(ctx, target.targetOwnerId!)
      if (sunk) markForceDirty(ctx, callerId)
      ctx.game.discard_pile = [...ctx.game.discard_pile, cardId]
      markGameDirty(ctx)
      log(
        ctx,
        seat,
        `${nameOf(ctx, callerId)} used a ${card.type === 'submarine' ? 'Submarine' : 'Torpedo Boat'} on ` +
          `${shipName(target.targetShipId)} - rolled ${roll}` +
          (sunk ? ' - sunk!' : ' - no effect.')
      )
      if (sunk) checkEliminationAndMaybeEndRound(ctx, target.targetOwnerId!)
      return
    }
    case 'additional_ship': {
      ctx.game.discard_pile = [...ctx.game.discard_pile, cardId]
      markGameDirty(ctx)
      resolveAdditionalShip(ctx, callerId)
      return
    }
    case 'repair': {
      if (!target.targetShipId || !target.targetSalvoCardId) {
        throw new HttpError(400, 'targetShipId and targetSalvoCardId are required')
      }
      const force = requireForce(ctx, callerId)
      const removedCardIds = engine.repairShip(force, target.targetShipId, target.targetSalvoCardId)
      markForceDirty(ctx, callerId)
      ctx.game.discard_pile = [...ctx.game.discard_pile, cardId, ...removedCardIds]
      markGameDirty(ctx)
      log(ctx, seat, `${nameOf(ctx, callerId)} repaired ${shipName(target.targetShipId)}.`)
      return
    }
    case 'minesweeper': {
      const force = requireForce(ctx, callerId)
      const removedMineCardIds = force.minefields.map((m) => m.id)
      engine.clearMinefields(force)
      markForceDirty(ctx, callerId)
      ctx.game.discard_pile = [...ctx.game.discard_pile, cardId, ...removedMineCardIds]
      markGameDirty(ctx)
      log(ctx, seat, `${nameOf(ctx, callerId)} swept all minefields from their fleet.`)
      return
    }
    case 'smoke': {
      const force = requireForce(ctx, callerId)
      force.smoke_active = true
      markForceDirty(ctx, callerId)
      log(ctx, seat, `${nameOf(ctx, callerId)} laid down a smoke screen.`)
      return
    }
    case 'destroyer_squadron': {
      const db = ctx.db
      void db
        .from('destroyer_squadrons')
        .insert({ game_id: ctx.game.id, owner_id: callerId, card_id: cardId, hits_taken: 0 })
        .then(({ error }) => {
          if (error) console.error(error)
        })
      log(ctx, seat, `${nameOf(ctx, callerId)} deployed a Destroyer Squadron.`)
      return
    }
    default:
      throw new HttpError(400, `Cannot play card of type ${card.type} this way`)
  }
}

function applySalvoToDestroyerSquadron(
  ctx: GameContext,
  callerId: string,
  salvoCardId: string,
  squadronId: string
) {
  const card = getPlayCard(salvoCardId)
  const squadron = ctx.destroyerSquadrons.find((s) => s.id === squadronId)
  if (!squadron) throw new HttpError(400, 'That Destroyer Squadron is no longer there')
  if (squadron.owner_id === callerId) throw new HttpError(400, "You can't fire on your own Destroyer Squadron")
  const myForce = requireForce(ctx, callerId)
  const ownsMatchingGun = myForce.ships.some((s) => !s.sunk && getShip(s.shipId).gunSize === card.gunSize)
  if (!ownsMatchingGun) throw new HttpError(400, `You have no ${card.gunSize}" ship to fire this Salvo`)

  squadron.hits_taken += card.damage!
  const destroyed = squadron.hits_taken >= 4
  ctx.game.discard_pile = [...ctx.game.discard_pile, salvoCardId]
  markGameDirty(ctx)
  void ctx.db
    .from('destroyer_squadrons')
    .update({ hits_taken: squadron.hits_taken })
    .eq('id', squadron.id)
    .then(({ error }) => {
      if (error) console.error(error)
    })
  log(
    ctx,
    seatOf(ctx, callerId),
    `${nameOf(ctx, callerId)} fired on the Destroyer Squadron (${squadron.hits_taken}/4 hits)` +
      (destroyed ? ' - destroyed!' : '.')
  )
  if (destroyed) {
    ctx.destroyerSquadrons = ctx.destroyerSquadrons.filter((s) => s.id !== squadron.id)
    ctx.game.discard_pile = [...ctx.game.discard_pile, squadron.card_id]
    void ctx.db.from('destroyer_squadrons').delete().eq('id', squadron.id)
  }
}

// ───────────────────────────────────────────────────────────────────────
// discard
// ───────────────────────────────────────────────────────────────────────

async function handleDiscard(ctx: GameContext, callerId: string, payload: GameActionPayload) {
  const game = ctx.game
  const seat = seatOf(ctx, callerId)
  if (game.status !== 'in_progress') throw new HttpError(400, 'Not in normal play')
  if (game.turn_seat !== seat) throw new HttpError(403, "It's not your turn")
  if (!payload.cardId) throw new HttpError(400, 'cardId is required')
  const hand = requireHand(ctx, callerId)
  if (!hand.cards.includes(payload.cardId)) throw new HttpError(400, "That card isn't in your hand")
  hand.cards = hand.cards.filter((c) => c !== payload.cardId)
  markHandDirty(ctx, callerId)
  game.discard_pile = [...game.discard_pile, payload.cardId]
  markGameDirty(ctx)
  log(ctx, seat, `${nameOf(ctx, callerId)} discarded a card.`)
  await finishTurnAction(ctx)
  return { resolved: true }
}

// ───────────────────────────────────────────────────────────────────────
// pass_special (end of one player's setup-phase segment)
// ───────────────────────────────────────────────────────────────────────

async function handlePassSpecial(ctx: GameContext, callerId: string) {
  const game = ctx.game
  const seat = seatOf(ctx, callerId)
  if (game.status !== 'special_phase') throw new HttpError(400, 'Not in the setup phase')
  if (game.special_phase_seat !== seat) throw new HttpError(403, 'Not your setup turn')

  const hand = requireHand(ctx, callerId)
  const kept: string[] = []
  const discarded: string[] = []
  for (const c of hand.cards) {
    if (getPlayCard(c).type === 'additional_damage') discarded.push(c)
    else kept.push(c)
  }
  if (discarded.length > 0) {
    game.discard_pile = [...game.discard_pile, ...discarded]
  }
  const dealCount = engine.dealCountFor(ctx.players.length)
  const need = Math.max(0, dealCount - kept.length)
  const drawn = game.draw_pile.slice(0, need)
  game.draw_pile = game.draw_pile.slice(need)
  hand.cards = [...kept, ...drawn]
  markHandDirty(ctx, callerId)
  markGameDirty(ctx)
  log(ctx, seat, `${nameOf(ctx, callerId)} finished setup and drew back up to ${hand.cards.length} cards.`)

  const next = engine.nextSeat(ctx.players, seat, false)
  if (next === null || next === game.dealer_seat) {
    game.status = 'in_progress'
    game.turn_seat = game.dealer_seat
    game.special_phase_seat = null
    log(ctx, game.dealer_seat, `Setup complete. ${nameOf(ctx, dealerUserId(ctx))} takes the first turn.`)
  } else {
    game.special_phase_seat = next
  }
  markGameDirty(ctx)
  await ctxSaveOnly(ctx)
  return { resolved: true }
}

function dealerUserId(ctx: GameContext): string {
  const p = ctx.players.find((p) => p.seat_index === ctx.game.dealer_seat)
  return p?.user_id ?? ''
}

// ───────────────────────────────────────────────────────────────────────
// airstrike
// ───────────────────────────────────────────────────────────────────────

async function handleAirstrike(ctx: GameContext, callerId: string, payload: GameActionPayload) {
  const game = ctx.game
  const seat = seatOf(ctx, callerId)
  if (game.status !== 'in_progress') throw new HttpError(400, 'Not in normal play')
  if (game.turn_seat !== seat) throw new HttpError(403, "It's not your turn")
  if (ctx.destroyerSquadrons.some((s) => s.owner_id === callerId)) {
    throw new HttpError(400, 'Resolve your Destroyer Squadron attack first')
  }
  const strikes = payload.strikes ?? []
  if (strikes.length === 0) throw new HttpError(400, 'Declare at least one strike')

  const myForce = requireForce(ctx, callerId)
  for (const s of strikes) {
    const carrier = myForce.ships.find((sh) => sh.shipId === s.carrierShipId)
    if (!carrier || carrier.sunk) throw new HttpError(400, 'You do not own that carrier')
    if (!getShip(s.carrierShipId).isCarrier) throw new HttpError(400, 'That ship is not a carrier')
    if (s.targetOwnerId === callerId) throw new HttpError(400, "You can't strike your own fleet")
  }

  for (const s of strikes) {
    const force = opponentForce(ctx, callerId, s.targetOwnerId)
    if (!engine.isTargetable(force, s.targetShipId)) {
      log(ctx, seat, `${nameOf(ctx, callerId)}'s airstrike on ${shipName(s.targetShipId)} has no valid target - skipped.`)
      continue
    }
    const roll = engine.rollDie()
    const { sunk } = engine.resolveAirstrike(force, s.targetShipId, roll, callerId, ctx.taskForces)
    markForceDirty(ctx, s.targetOwnerId)
    if (sunk) markForceDirty(ctx, callerId)
    log(
      ctx,
      seat,
      `${nameOf(ctx, callerId)} launched an airstrike on ${shipName(s.targetShipId)} - rolled ${roll}` +
        (sunk ? ' - sunk!' : ' - no effect.')
    )
    if (sunk) checkEliminationAndMaybeEndRound(ctx, s.targetOwnerId)
  }

  await finishTurnAction(ctx)
  return { resolved: true }
}

// ───────────────────────────────────────────────────────────────────────
// resolve_destroyer
// ───────────────────────────────────────────────────────────────────────

async function handleResolveDestroyer(ctx: GameContext, callerId: string, payload: GameActionPayload) {
  const game = ctx.game
  const seat = seatOf(ctx, callerId)
  if (game.status !== 'in_progress') throw new HttpError(400, 'Not in normal play')
  if (game.turn_seat !== seat) throw new HttpError(403, "It's not your turn")
  const squadron = ctx.destroyerSquadrons.find((s) => s.owner_id === callerId)
  if (!squadron) throw new HttpError(400, 'You have no Destroyer Squadron to resolve')
  const resolution = payload.destroyerResolution
  if (!resolution) throw new HttpError(400, 'destroyerResolution is required')

  const force = opponentForce(ctx, callerId, resolution.targetOwnerId)
  const roll = engine.rollDie()
  const sunk = engine.resolveDestroyerAttack(force, resolution.priorityShipIds, roll, callerId, ctx.taskForces)
  markForceDirty(ctx, resolution.targetOwnerId)
  if (sunk.length > 0) markForceDirty(ctx, callerId)

  ctx.destroyerSquadrons = ctx.destroyerSquadrons.filter((s) => s.id !== squadron.id)
  ctx.game.discard_pile = [...ctx.game.discard_pile, squadron.card_id]
  markGameDirty(ctx)
  void ctx.db.from('destroyer_squadrons').delete().eq('id', squadron.id)

  log(
    ctx,
    seat,
    `${nameOf(ctx, callerId)}'s Destroyer Squadron attacked ${nameOf(ctx, resolution.targetOwnerId)} - ` +
      `rolled ${roll}, sank ${sunk.length > 0 ? sunk.map(shipName).join(', ') : 'nothing'}.`
  )
  if (sunk.length > 0) checkEliminationAndMaybeEndRound(ctx, resolution.targetOwnerId)

  if (!(await maybeEndRoundOnly(ctx))) {
    await ctxSaveOnly(ctx)
  }
  return { resolved: true, roll, sunk }
}

// ───────────────────────────────────────────────────────────────────────
// Turn / round finalization
// ───────────────────────────────────────────────────────────────────────

/** If elimination has left only one active player, end the round now. Returns true if it did. */
async function maybeEndRoundOnly(ctx: GameContext): Promise<boolean> {
  if (engine.countActive(ctx.players) === 1) {
    await endRound(ctx)
    return true
  }
  return false
}

/** Called after a normal-turn action completes: ends the round if elimination left one player standing or the draw pile is now empty, otherwise advances to the next player. */
async function finishTurnAction(ctx: GameContext) {
  const game = ctx.game

  if (await maybeEndRoundOnly(ctx)) return

  if (game.draw_pile.length === 0) {
    await endRound(ctx)
    return
  }

  const seat = seatOf(ctx, currentTurnUserId(ctx))
  const next = engine.nextSeat(ctx.players, seat, true)
  game.turn_seat = next
  markGameDirty(ctx)

  // Smoke lasts until the owner's next turn, discarded just before it starts.
  const nextPlayer = ctx.players.find((p) => p.seat_index === next)
  if (nextPlayer) {
    const nextForce = requireForce(ctx, nextPlayer.user_id)
    if (nextForce.smoke_active) {
      nextForce.smoke_active = false
      markForceDirty(ctx, nextPlayer.user_id)
      log(ctx, next, `${nextPlayer.display_name}'s smoke screen clears.`)
    }
  }

  await ctxSaveOnly(ctx)
}

function currentTurnUserId(ctx: GameContext): string {
  const p = ctx.players.find((p) => p.seat_index === ctx.game.turn_seat)
  if (!p) throw new HttpError(500, 'No current player')
  return p.user_id
}

async function endRound(ctx: GameContext) {
  const game = ctx.game
  const deltas = engine.scoreRound(ctx.players, [...ctx.taskForces.values()])
  for (const d of deltas) {
    const p = findPlayer(ctx, d.userId)
    p.total_score += d.total
  }
  for (const p of ctx.players) {
    log(
      ctx,
      p.seat_index,
      `Round ${game.current_round} score for ${p.display_name}: ${
        deltas.find((d) => d.userId === p.user_id)?.total ?? 0
      } (total ${p.total_score}).`
    )
  }

  const maxScore = Math.max(...ctx.players.map((p) => p.total_score))
  const leaders = ctx.players.filter((p) => p.total_score === maxScore)
  const gameOver = maxScore >= game.target_score && leaders.length === 1

  if (gameOver) {
    game.status = 'finished'
    log(ctx, leaders[0].seat_index, `${leaders[0].display_name} wins the game with ${maxScore} points!`)
    markGameDirty(ctx)
    await savePlayerScores(ctx.db, game.id, ctx.players)
    await ctxSaveOnly(ctx)
    return
  }

  // Start a new round.
  const newDealer = ctx.players.slice().sort((a, b) => b.total_score - a.total_score || a.seat_index - b.seat_index)[0]
  for (const p of ctx.players) p.is_eliminated_this_round = false

  const dealt = engine.dealNewGame(ctx.players)
  for (const p of ctx.players) {
    const hand = requireHand(ctx, p.user_id)
    hand.cards = dealt.hands[p.user_id]
    markHandDirty(ctx, p.user_id)
    const force = requireForce(ctx, p.user_id)
    force.ships = dealt.taskForces[p.user_id]
    force.minefields = []
    force.smoke_active = false
    force.deep_six = []
    markForceDirty(ctx, p.user_id)
  }
  for (const sq of ctx.destroyerSquadrons) {
    void ctx.db.from('destroyer_squadrons').delete().eq('id', sq.id)
  }
  ctx.destroyerSquadrons = []

  game.current_round += 1
  game.dealer_seat = newDealer.seat_index
  game.special_phase_seat = newDealer.seat_index
  game.turn_seat = null
  game.status = 'special_phase'
  game.draw_pile = dealt.drawPile
  game.harbor_pile = dealt.harborPile
  game.discard_pile = []
  game.pending_drawn_card = null
  markGameDirty(ctx)
  log(ctx, newDealer.seat_index, `Round ${game.current_round} begins. ${newDealer.display_name} deals.`)

  await savePlayerScores(ctx.db, game.id, ctx.players)
  await ctxSaveOnly(ctx)
}

async function ctxSaveOnly(ctx: GameContext) {
  await saveContext(ctx)
}

// ───────────────────────────────────────────────────────────────────────
// Dispatch
// ───────────────────────────────────────────────────────────────────────

export async function dispatchAction(ctx: GameContext, callerId: string, payload: GameActionPayload) {
  findPlayer(ctx, callerId) // throws if not seated
  switch (payload.type) {
    case 'draw':
      return handleDraw(ctx, callerId)
    case 'play':
      return handlePlay(ctx, callerId, payload)
    case 'discard':
      return handleDiscard(ctx, callerId, payload)
    case 'pass_special':
      return handlePassSpecial(ctx, callerId)
    case 'airstrike':
      return handleAirstrike(ctx, callerId, payload)
    case 'resolve_destroyer':
      return handleResolveDestroyer(ctx, callerId, payload)
    default:
      throw new HttpError(400, `Unknown action type: ${(payload as { type: string }).type}`)
  }
}

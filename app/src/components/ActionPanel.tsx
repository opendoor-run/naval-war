import { useState } from 'react'
import { getPlayCard, getShip, CARD_TYPE_LABELS } from '../lib/cards'
import { CardImage } from './CardImage'
import type { ActionTarget, DestroyerSquadronRow, GamePlayerRow, TaskForceRow } from '../types/game'

function chip(active: boolean): string {
  return `ptc-chip px-2 py-1 text-xs ${active ? 'ptc-chip-active' : ''}`
}

export function ActionPanel({
  cardId,
  title,
  players,
  myUserId,
  taskForces,
  destroyerSquadrons,
  onConfirm,
  onCancel,
  busy,
  allowCancel = true,
}: {
  cardId: string
  title: string
  players: GamePlayerRow[]
  myUserId: string
  taskForces: Record<string, TaskForceRow>
  destroyerSquadrons: DestroyerSquadronRow[]
  onConfirm: (target: ActionTarget) => void
  onCancel: () => void
  busy: boolean
  allowCancel?: boolean
}) {
  const card = getPlayCard(cardId)
  const [targetOwnerId, setTargetOwnerId] = useState<string | null>(null)
  const [targetShipId, setTargetShipId] = useState<string | null>(null)
  const [targetSalvoId, setTargetSalvoId] = useState<string | null>(null)
  const [targetSquadronId, setTargetSquadronId] = useState<string | null>(null)

  // Smoke blocks everything except Submarines and Additional Damage.
  const bypassesSmoke = card.type === 'submarine' || card.type === 'additional_damage'
  const opponents = players
    .filter((p) => p.user_id !== myUserId && !p.is_eliminated_this_round)
    .filter((p) => bypassesSmoke || !taskForces[p.user_id]?.smoke_active)
  const noTargetNeeded = ['additional_ship', 'minesweeper', 'smoke', 'destroyer_squadron'].includes(card.type)
  const isOwnShipCard = card.type === 'repair'

  function confirm() {
    if (noTargetNeeded) return onConfirm({})
    if (targetSquadronId) return onConfirm({ targetDestroyerSquadronId: targetSquadronId })
    const target: ActionTarget = {}
    if (isOwnShipCard) {
      if (!targetShipId || !targetSalvoId) return
      onConfirm({ targetShipId, targetSalvoCardId: targetSalvoId })
      return
    }
    if (!targetOwnerId) return
    target.targetOwnerId = targetOwnerId
    if (card.type === 'minefield') return onConfirm(target)
    if (!targetShipId) return
    target.targetShipId = targetShipId
    if (card.type === 'additional_damage') {
      if (!targetSalvoId) return
      target.targetSalvoCardId = targetSalvoId
    }
    onConfirm(target)
  }

  const canConfirm =
    noTargetNeeded ||
    !!targetSquadronId ||
    (isOwnShipCard && !!targetShipId && !!targetSalvoId) ||
    (card.type === 'minefield' && !!targetOwnerId) ||
    ((card.type === 'submarine' || card.type === 'torpedo_boat') && !!targetOwnerId && !!targetShipId) ||
    (card.type === 'salvo' && (!!targetSquadronId || (!!targetOwnerId && !!targetShipId))) ||
    (card.type === 'additional_damage' && !!targetOwnerId && !!targetShipId && !!targetSalvoId)

  const ownForce = taskForces[myUserId]
  const targetForce = targetOwnerId ? taskForces[targetOwnerId] : undefined

  return (
    <div className="ptc-panel ptc-rivets p-4">
      <div className="mb-3 flex items-center gap-3">
        <CardImage cardId={cardId} size="sm" />
        <div>
          <p className="ptc-headline text-sm">{title}</p>
          <p className="ptc-mono text-xs text-[var(--ink-soft)]">{CARD_TYPE_LABELS[card.type]}</p>
        </div>
      </div>

      {card.type === 'salvo' && destroyerSquadrons.filter((s) => s.owner_id !== myUserId).length > 0 && (
        <div className="mb-3">
          <p className="ptc-mono mb-1 text-xs text-[var(--ink-soft)]">Fire at a Destroyer Squadron instead?</p>
          <div className="flex flex-wrap gap-2">
            {destroyerSquadrons
              .filter((s) => s.owner_id !== myUserId)
              .map((s) => (
                <button
                  key={s.id}
                  onClick={() => {
                    setTargetSquadronId(s.id)
                    setTargetOwnerId(null)
                    setTargetShipId(null)
                  }}
                  className={chip(targetSquadronId === s.id)}
                >
                  {players.find((p) => p.user_id === s.owner_id)?.display_name}'s Squadron ({s.hits_taken}/4)
                </button>
              ))}
          </div>
        </div>
      )}

      {!isOwnShipCard && !noTargetNeeded && !targetSquadronId && (
        <div className="mb-3">
          <p className="ptc-mono mb-1 text-xs text-[var(--ink-soft)]">Target player</p>
          <div className="flex flex-wrap gap-2">
            {opponents.map((p) => (
              <button
                key={p.user_id}
                onClick={() => {
                  setTargetOwnerId(p.user_id)
                  setTargetShipId(null)
                  setTargetSalvoId(null)
                }}
                className={chip(targetOwnerId === p.user_id)}
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isOwnShipCard && card.type !== 'minefield' && targetForce && !targetSquadronId && (
        <div className="mb-3">
          <p className="ptc-mono mb-1 text-xs text-[var(--ink-soft)]">Target ship</p>
          <div className="flex flex-wrap gap-2">
            {targetForce.ships
              .filter((s) => !s.sunk)
              .map((s) => (
                <button
                  key={s.shipId}
                  onClick={() => {
                    setTargetShipId(s.shipId)
                    setTargetSalvoId(null)
                  }}
                  className={chip(targetShipId === s.shipId)}
                >
                  {getShip(s.shipId).name}
                </button>
              ))}
          </div>
        </div>
      )}

      {card.type === 'additional_damage' && targetShipId && targetForce && (
        <div className="mb-3">
          <p className="ptc-mono mb-1 text-xs text-[var(--ink-soft)]">Salvo stack to boost</p>
          <div className="flex flex-wrap gap-2">
            {targetForce.ships
              .find((s) => s.shipId === targetShipId)
              ?.salvos.map((salvo) => (
                <button key={salvo.id} onClick={() => setTargetSalvoId(salvo.id)} className={chip(targetSalvoId === salvo.id)}>
                  {salvo.gunSize}"-{salvo.damage}
                </button>
              ))}
          </div>
        </div>
      )}

      {isOwnShipCard && ownForce && (
        <div className="mb-3">
          <p className="ptc-mono mb-1 text-xs text-[var(--ink-soft)]">Your ship to repair</p>
          <div className="flex flex-wrap gap-2">
            {ownForce.ships
              .filter((s) => !s.sunk && s.salvos.length > 0)
              .map((s) => (
                <button
                  key={s.shipId}
                  onClick={() => {
                    setTargetShipId(s.shipId)
                    setTargetSalvoId(null)
                  }}
                  className={chip(targetShipId === s.shipId)}
                >
                  {getShip(s.shipId).name}
                </button>
              ))}
          </div>
        </div>
      )}

      {isOwnShipCard && targetShipId && ownForce && (
        <div className="mb-3">
          <p className="ptc-mono mb-1 text-xs text-[var(--ink-soft)]">Salvo stack to remove</p>
          <div className="flex flex-wrap gap-2">
            {ownForce.ships
              .find((s) => s.shipId === targetShipId)
              ?.salvos.map((salvo) => (
                <button key={salvo.id} onClick={() => setTargetSalvoId(salvo.id)} className={chip(targetSalvoId === salvo.id)}>
                  {salvo.gunSize}"-{salvo.damage}
                  {salvo.additionalDamage.length > 0 ? ` (+${salvo.additionalDamage.length})` : ''}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button onClick={confirm} disabled={!canConfirm || busy} className="ptc-btn ptc-btn-primary px-4 py-1.5 text-sm">
          {busy ? 'Working...' : 'Confirm'}
        </button>
        {allowCancel && (
          <button onClick={onCancel} disabled={busy} className="ptc-btn px-4 py-1.5 text-sm">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

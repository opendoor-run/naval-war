import { useState } from 'react'
import { getPlayCard, getShip, CARD_TYPE_LABELS } from '../lib/cards'
import { CardImage } from './CardImage'
import type { ActionTarget, DestroyerSquadronRow, GamePlayerRow, TaskForceRow } from '../types/game'

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

  const opponents = players.filter((p) => p.user_id !== myUserId && !p.is_eliminated_this_round)
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
    <div className="rounded-xl border border-amber-300/40 bg-black/40 p-4">
      <div className="mb-3 flex items-center gap-3">
        <CardImage cardId={cardId} size="sm" />
        <div>
          <p className="font-semibold text-white">{title}</p>
          <p className="text-xs text-white/60">{CARD_TYPE_LABELS[card.type]}</p>
        </div>
      </div>

      {card.type === 'salvo' && destroyerSquadrons.filter((s) => s.owner_id !== myUserId).length > 0 && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-white/60">Fire at a Destroyer Squadron instead?</p>
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
                  className={`rounded-md border px-2 py-1 text-xs ${
                    targetSquadronId === s.id ? 'border-amber-300 bg-amber-400/20' : 'border-white/20 bg-white/5'
                  }`}
                >
                  {players.find((p) => p.user_id === s.owner_id)?.display_name}'s Squadron ({s.hits_taken}/4)
                </button>
              ))}
          </div>
        </div>
      )}

      {!isOwnShipCard && !noTargetNeeded && !targetSquadronId && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-white/60">Target player</p>
          <div className="flex flex-wrap gap-2">
            {opponents.map((p) => (
              <button
                key={p.user_id}
                onClick={() => {
                  setTargetOwnerId(p.user_id)
                  setTargetShipId(null)
                  setTargetSalvoId(null)
                }}
                className={`rounded-md border px-2 py-1 text-xs ${
                  targetOwnerId === p.user_id ? 'border-amber-300 bg-amber-400/20' : 'border-white/20 bg-white/5'
                }`}
              >
                {p.display_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {!isOwnShipCard && card.type !== 'minefield' && targetForce && !targetSquadronId && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-white/60">Target ship</p>
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
                  className={`rounded border px-2 py-1 text-xs ${
                    targetShipId === s.shipId ? 'border-amber-300 bg-amber-400/20' : 'border-white/20 bg-white/5'
                  }`}
                >
                  {getShip(s.shipId).name}
                </button>
              ))}
          </div>
        </div>
      )}

      {card.type === 'additional_damage' && targetShipId && targetForce && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-white/60">Salvo stack to boost</p>
          <div className="flex flex-wrap gap-2">
            {targetForce.ships
              .find((s) => s.shipId === targetShipId)
              ?.salvos.map((salvo) => (
                <button
                  key={salvo.id}
                  onClick={() => setTargetSalvoId(salvo.id)}
                  className={`rounded border px-2 py-1 text-xs ${
                    targetSalvoId === salvo.id ? 'border-amber-300 bg-amber-400/20' : 'border-white/20 bg-white/5'
                  }`}
                >
                  {salvo.gunSize}"-{salvo.damage}
                </button>
              ))}
          </div>
        </div>
      )}

      {isOwnShipCard && ownForce && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-white/60">Your ship to repair</p>
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
                  className={`rounded border px-2 py-1 text-xs ${
                    targetShipId === s.shipId ? 'border-amber-300 bg-amber-400/20' : 'border-white/20 bg-white/5'
                  }`}
                >
                  {getShip(s.shipId).name}
                </button>
              ))}
          </div>
        </div>
      )}

      {isOwnShipCard && targetShipId && ownForce && (
        <div className="mb-3">
          <p className="mb-1 text-xs text-white/60">Salvo stack to remove</p>
          <div className="flex flex-wrap gap-2">
            {ownForce.ships
              .find((s) => s.shipId === targetShipId)
              ?.salvos.map((salvo) => (
                <button
                  key={salvo.id}
                  onClick={() => setTargetSalvoId(salvo.id)}
                  className={`rounded border px-2 py-1 text-xs ${
                    targetSalvoId === salvo.id ? 'border-amber-300 bg-amber-400/20' : 'border-white/20 bg-white/5'
                  }`}
                >
                  {salvo.gunSize}"-{salvo.damage}
                  {salvo.additionalDamage.length > 0 ? ` (+${salvo.additionalDamage.length})` : ''}
                </button>
              ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <button
          onClick={confirm}
          disabled={!canConfirm || busy}
          className="rounded-md bg-amber-400 px-4 py-1.5 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-40"
        >
          {busy ? 'Working...' : 'Confirm'}
        </button>
        {allowCancel && (
          <button
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border border-white/20 px-4 py-1.5 text-sm text-white/80 hover:bg-white/10"
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

import { useState } from 'react'
import { getShip } from '../lib/cards'
import { Hand } from './Hand'
import { TaskForceView } from './TaskForceView'
import { ScorePanel } from './ScorePanel'
import { GameLog } from './GameLog'
import { ActionPanel } from './ActionPanel'
import { AirstrikePanel } from './AirstrikePanel'
import { DestroyerResolvePanel } from './DestroyerResolvePanel'
import type {
  ActionTarget,
  AirstrikeDeclaration,
  DestroyerSquadronRow,
  GameActionPayload,
  GameLogRow,
  GamePlayerRow,
  GameRow,
  HandRow,
  TaskForceRow,
} from '../types/game'

/** Pure presentational board - fed real data + a dispatch function by GamePage, or mock data by PreviewPage. */
export function GameBoard({
  game,
  players,
  myUserId,
  myHand,
  taskForces,
  destroyerSquadrons,
  log,
  dispatch,
}: {
  game: GameRow
  players: GamePlayerRow[]
  myUserId: string
  myHand: HandRow | null
  taskForces: Record<string, TaskForceRow>
  destroyerSquadrons: DestroyerSquadronRow[]
  log: GameLogRow[]
  dispatch: (payload: GameActionPayload) => Promise<unknown>
}) {
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [mode, setMode] = useState<'idle' | 'airstrike'>('idle')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const myPlayer = players.find((p) => p.user_id === myUserId)
  const mySquadron = destroyerSquadrons.find((s) => s.owner_id === myUserId)
  const myForce = taskForces[myUserId]

  if (!myPlayer) return null

  const isMyNormalTurn = game.status === 'in_progress' && game.turn_seat === myPlayer.seat_index
  const isMySpecialTurn = game.status === 'special_phase' && game.special_phase_seat === myPlayer.seat_index
  const mustResolveSquadron = isMyNormalTurn && !!mySquadron
  const hasPendingDrawn = isMyNormalTurn && !!game.pending_drawn_card

  async function run(fn: () => Promise<unknown>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
      setSelectedCardId(null)
      setMode('idle')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  function handlePlayTarget(cardId: string, target: ActionTarget) {
    run(() => dispatch({ gameId: game.id, type: 'play', cardId, target }))
  }

  return (
    <div className="felt-table min-h-screen text-white">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6 lg:grid-cols-[1fr_280px]">
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3 text-sm text-white/70">
            <span>Draw pile: {game.draw_pile.length}</span>
            <span>Discard: {game.discard_pile.length}</span>
            <span>Harbor: {game.harbor_pile.length}</span>
            {game.status === 'finished' && <span className="font-bold text-amber-300">Game over!</span>}
          </div>

          {/* Opponent fleets */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {players
              .filter((p) => p.user_id !== myUserId)
              .map((p) => (
                <TaskForceView key={p.user_id} force={taskForces[p.user_id]} ownerName={p.display_name} isMine={false} />
              ))}
          </div>

          {/* My fleet */}
          <TaskForceView force={myForce} ownerName={myPlayer.display_name} isMine />

          {error && <p className="rounded bg-red-950/60 px-3 py-2 text-sm text-red-300">{error}</p>}

          {/* Contextual prompts, highest priority first */}
          {mustResolveSquadron && (
            <DestroyerResolvePanel
              myUserId={myUserId}
              players={players}
              taskForces={taskForces}
              busy={busy}
              onConfirm={(targetOwnerId, priorityShipIds) =>
                run(() =>
                  dispatch({
                    gameId: game.id,
                    type: 'resolve_destroyer',
                    destroyerResolution: { targetOwnerId, priorityShipIds },
                  })
                )
              }
            />
          )}

          {!mustResolveSquadron && hasPendingDrawn && game.pending_drawn_card && (
            <ActionPanel
              cardId={game.pending_drawn_card}
              title="You drew this card - resolve it now"
              players={players}
              myUserId={myUserId}
              taskForces={taskForces}
              destroyerSquadrons={destroyerSquadrons}
              busy={busy}
              allowCancel={false}
              onCancel={() => {}}
              onConfirm={(target) => handlePlayTarget(game.pending_drawn_card!, target)}
            />
          )}

          {!mustResolveSquadron && !hasPendingDrawn && mode === 'airstrike' && myForce && (
            <AirstrikePanel
              myUserId={myUserId}
              myForce={myForce}
              players={players}
              taskForces={taskForces}
              busy={busy}
              onCancel={() => setMode('idle')}
              onConfirm={(strikes: AirstrikeDeclaration[]) =>
                run(() => dispatch({ gameId: game.id, type: 'airstrike', strikes }))
              }
            />
          )}

          {!mustResolveSquadron && !hasPendingDrawn && mode === 'idle' && selectedCardId && (
            <ActionPanel
              cardId={selectedCardId}
              title={isMySpecialTurn ? 'Play during setup' : 'Play card'}
              players={players}
              myUserId={myUserId}
              taskForces={taskForces}
              destroyerSquadrons={destroyerSquadrons}
              busy={busy}
              onCancel={() => setSelectedCardId(null)}
              onConfirm={(target) => handlePlayTarget(selectedCardId, target)}
            />
          )}

          {/* Hand + turn controls */}
          <div className="rounded-xl border border-white/15 bg-black/25 p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-medium text-white/70">
                {isMySpecialTurn ? 'Your setup turn' : isMyNormalTurn ? 'Your turn' : 'Your hand'}
              </p>
              {isMySpecialTurn && (
                <button
                  disabled={busy}
                  onClick={() => run(() => dispatch({ gameId: game.id, type: 'pass_special' }))}
                  className="rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-40"
                >
                  Done with setup
                </button>
              )}
              {isMyNormalTurn && !hasPendingDrawn && !mustResolveSquadron && (
                <div className="flex gap-2">
                  {myForce?.ships.some((s) => !s.sunk && getShip(s.shipId).isCarrier) && (
                    <button
                      disabled={busy}
                      onClick={() => setMode('airstrike')}
                      className="rounded-md border border-white/20 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
                    >
                      Airstrike
                    </button>
                  )}
                  {selectedCardId && (
                    <button
                      disabled={busy}
                      onClick={() => run(() => dispatch({ gameId: game.id, type: 'discard', cardId: selectedCardId }))}
                      className="rounded-md border border-white/20 px-3 py-1 text-xs text-white/80 hover:bg-white/10"
                    >
                      Discard selected
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => run(() => dispatch({ gameId: game.id, type: 'draw' }))}
                    className="rounded-md bg-amber-400 px-3 py-1 text-xs font-semibold text-black hover:bg-amber-300 disabled:opacity-40"
                  >
                    Draw
                  </button>
                </div>
              )}
            </div>
            <Hand
              cards={myHand?.cards ?? []}
              selectedCardId={selectedCardId}
              onSelect={setSelectedCardId}
              specialPhaseMode={isMySpecialTurn}
            />
          </div>
        </div>

        <div className="space-y-4">
          <ScorePanel game={game} players={players} myUserId={myUserId} />
          {destroyerSquadrons.length > 0 && (
            <div className="rounded-xl border border-white/15 bg-black/25 p-3 text-sm">
              <p className="mb-1 font-medium text-white/70">Destroyer Squadrons</p>
              {destroyerSquadrons.map((s) => (
                <p key={s.id} className="text-white/70">
                  {players.find((p) => p.user_id === s.owner_id)?.display_name}: {s.hits_taken}/4 hits
                </p>
              ))}
            </div>
          )}
          <div className="h-64">
            <GameLog log={log} />
          </div>
        </div>
      </div>
    </div>
  )
}

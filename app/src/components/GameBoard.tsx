import { useEffect, useState } from 'react'
import { getShip } from '../lib/cards'
import { Hand } from './Hand'
import { TaskForceView } from './TaskForceView'
import { TurnTracker } from './TurnTracker'
import { ScorePanel } from './ScorePanel'
import { GameLog } from './GameLog'
import { ActionPanel } from './ActionPanel'
import { AirstrikePanel } from './AirstrikePanel'
import { DestroyerResolvePanel } from './DestroyerResolvePanel'
import { AppHeader } from './AppHeader'
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
  // A squadron we've already resolved but that Realtime hasn't confirmed deleted yet -
  // without this the panel stays up during that gap and a second click 400s.
  const [resolvedSquadronId, setResolvedSquadronId] = useState<string | null>(null)

  const myPlayer = players.find((p) => p.user_id === myUserId)
  const mySquadron = destroyerSquadrons.find((s) => s.owner_id === myUserId && s.id !== resolvedSquadronId)
  const myForce = taskForces[myUserId]

  const isMyNormalTurn = game.status === 'in_progress' && game.turn_seat === myPlayer?.seat_index
  const isMySpecialTurn = game.status === 'special_phase' && game.special_phase_seat === myPlayer?.seat_index

  useEffect(() => {
    if (!isMyNormalTurn && !isMySpecialTurn) {
      setSelectedCardId(null)
      setMode('idle')
    }
  }, [isMyNormalTurn, isMySpecialTurn])

  if (!myPlayer) return null

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
    <div className="command-room min-h-screen">
      <AppHeader />
      <div className="mx-auto max-w-[clamp(72rem,92vw,100rem)] px-4 pt-6">
        <TurnTracker game={game} players={players} destroyerSquadrons={destroyerSquadrons} myUserId={myUserId} />
      </div>
      <div className="mx-auto grid max-w-[clamp(72rem,92vw,100rem)] grid-cols-1 gap-4 px-4 pb-6 pt-4 lg:grid-cols-[1fr_280px] 2xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <div className="ptc-mono flex flex-wrap items-center gap-3 text-sm text-[var(--ink-soft)]">
            <span>Draw pile: {game.draw_pile.length}</span>
            <span>Discard: {game.discard_pile.length}</span>
            <span>Harbor: {game.harbor_pile.length}</span>
          </div>

          {/* Opponent fleets */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[repeat(auto-fit,minmax(300px,1fr))]">
            {players
              .filter((p) => p.user_id !== myUserId)
              .map((p) => (
                <TaskForceView key={p.user_id} force={taskForces[p.user_id]} ownerName={p.display_name} isMine={false} players={players} />
              ))}
          </div>

          {/* My fleet */}
          <TaskForceView force={myForce} ownerName={myPlayer.display_name} isMine players={players} />

          {error && (
            <p className="ptc-mono border-2 border-[var(--red)] bg-[var(--parchment-hi)] px-3 py-2 text-sm" style={{ color: 'var(--red)' }}>
              {error}
            </p>
          )}

          {/* Contextual prompts, highest priority first */}
          {mustResolveSquadron && (
            <DestroyerResolvePanel
              myUserId={myUserId}
              players={players}
              taskForces={taskForces}
              busy={busy}
              onConfirm={(targetOwnerId, priorityShipIds) => {
                const squadronId = mySquadron!.id
                run(async () => {
                  await dispatch({
                    gameId: game.id,
                    type: 'resolve_destroyer',
                    destroyerResolution: { targetOwnerId, priorityShipIds },
                  })
                  setResolvedSquadronId(squadronId)
                })
              }}
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

          {!mustResolveSquadron &&
            !hasPendingDrawn &&
            mode === 'idle' &&
            selectedCardId &&
            (isMyNormalTurn || isMySpecialTurn) && (
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
          <div className="ptc-panel ptc-clipboard ptc-rivets p-3">
            <div className="mb-2 flex items-center justify-between">
              <p className="ptc-headline text-sm">
                {isMySpecialTurn ? 'Your Setup Turn' : isMyNormalTurn ? 'Your Turn' : 'Your Hand'}
              </p>
              {isMySpecialTurn && (
                <button
                  disabled={busy}
                  onClick={() => run(() => dispatch({ gameId: game.id, type: 'pass_special' }))}
                  className="ptc-btn ptc-btn-primary px-3 py-1 text-xs"
                >
                  Done with Setup
                </button>
              )}
              {isMyNormalTurn && !hasPendingDrawn && !mustResolveSquadron && (
                <div className="flex gap-2">
                  {myForce?.ships.some((s) => !s.sunk && getShip(s.shipId).isCarrier) && (
                    <button disabled={busy} onClick={() => setMode('airstrike')} className="ptc-btn px-3 py-1 text-xs">
                      Airstrike
                    </button>
                  )}
                  {selectedCardId && (
                    <button
                      disabled={busy}
                      onClick={() => run(() => dispatch({ gameId: game.id, type: 'discard', cardId: selectedCardId }))}
                      className="ptc-btn px-3 py-1 text-xs"
                    >
                      Discard Selected
                    </button>
                  )}
                  <button
                    disabled={busy}
                    onClick={() => run(() => dispatch({ gameId: game.id, type: 'draw' }))}
                    className="ptc-btn ptc-btn-primary px-3 py-1 text-xs"
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
              interactive={isMyNormalTurn || isMySpecialTurn}
            />
          </div>
        </div>

        <div className="space-y-4">
          <ScorePanel game={game} players={players} myUserId={myUserId} />
          {destroyerSquadrons.length > 0 && (
            <div className="ptc-panel ptc-clipboard ptc-rivets p-3 text-sm">
              <p className="ptc-headline mb-1 text-sm">Destroyer Squadrons</p>
              {destroyerSquadrons.map((s) => (
                <p key={s.id} className="ptc-mono text-[var(--ink-soft)]">
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

export type GameStatus = 'lobby' | 'special_phase' | 'in_progress' | 'round_end' | 'finished'

export interface GameRow {
  id: string
  invite_token: string
  host_id: string
  target_score: number
  max_players: number
  status: GameStatus
  current_round: number
  dealer_seat: number | null
  turn_seat: number | null
  special_phase_seat: number | null
  draw_count: number
  discard_count: number
  harbor_count: number
  has_pending_card: boolean
  drawn_this_turn: boolean
  version: number
}

/** Server-only: the actual pile contents, split out of `games` (0005) so no
    client can ever read the deck/harbor order. */
export interface GameSecretsRow {
  game_id: string
  draw_pile: string[]
  discard_pile: string[]
  harbor_pile: string[]
}

/** The in-memory shape `GameContext.game` uses everywhere: the public row
    plus the secret piles, merged by `loadContext` and split back apart by
    `saveContext`. Lets engine/action code keep reading `game.draw_pile` etc.
    unchanged even though they now live in a different table. */
export type GameState = GameRow & Pick<GameSecretsRow, 'draw_pile' | 'discard_pile' | 'harbor_pile'>

export interface GamePlayerRow {
  game_id: string
  user_id: string
  seat_index: number
  display_name: string
  total_score: number
  is_eliminated_this_round: boolean
  is_bot: boolean
}

export interface HandRow {
  game_id: string
  user_id: string
  cards: string[]
  pending_card: string | null
}

export interface AdditionalDamage {
  id: string
  damage: number
  playedBy: string
}

export interface SalvoStack {
  id: string
  gunSize: number
  damage: number
  firedBy: string
  additionalDamage: AdditionalDamage[]
}

export interface ShipState {
  shipId: string
  damage: number
  sunk: boolean
  sunkBy?: string
  salvos: SalvoStack[]
}

export interface MinefieldState {
  id: string
  damage: number
  placedBy: string
}

export interface TaskForceRow {
  game_id: string
  owner_id: string
  ships: ShipState[]
  minefields: MinefieldState[]
  smoke_active: boolean
  deep_six: string[]
}

export interface DestroyerSquadronRow {
  id: string
  game_id: string
  owner_id: string
  card_id: string
  hits_taken: number
  created_at: string
}

export type ActionType =
  | 'draw'
  | 'play'
  | 'discard'
  | 'pass_special'
  | 'airstrike'
  | 'resolve_destroyer'
  | 'add_bot'

export interface ActionTarget {
  targetOwnerId?: string
  targetShipId?: string
  targetSalvoCardId?: string
  targetDestroyerSquadronId?: string
}

export interface AirstrikeDeclaration {
  carrierShipId: string
  targetOwnerId: string
  targetShipId: string
}

export interface GameActionPayload {
  gameId: string
  type: ActionType
  cardId?: string
  target?: ActionTarget
  strikes?: AirstrikeDeclaration[]
  destroyerResolution?: { targetOwnerId: string; priorityShipIds: string[] }
}

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
  draw_pile: string[]
  discard_pile: string[]
  harbor_pile: string[]
  pending_drawn_card: string | null
  version: number
}

export interface GamePlayerRow {
  game_id: string
  user_id: string
  seat_index: number
  display_name: string
  total_score: number
  is_eliminated_this_round: boolean
}

export interface HandRow {
  game_id: string
  user_id: string
  cards: string[]
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

export interface GameLogRow {
  id: number
  game_id: string
  seat_index: number | null
  message: string
  created_at: string
}

export type ActionType = 'draw' | 'play' | 'discard' | 'pass_special' | 'airstrike' | 'resolve_destroyer'

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

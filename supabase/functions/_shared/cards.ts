import cardsJson from './cards.json' with { type: 'json' }

export type ShipCard = {
  id: string
  sheet: string
  row: number
  col: number
  name: string
  country: string
  gunSize: number | null
  hitPoints: number
  isCarrier: boolean
}

export type PlayCardType =
  | 'salvo'
  | 'minefield'
  | 'submarine'
  | 'torpedo_boat'
  | 'additional_damage'
  | 'additional_ship'
  | 'repair'
  | 'minesweeper'
  | 'smoke'
  | 'destroyer_squadron'

export type PlayCard = {
  id: string
  sheet: string
  row: number
  col: number
  type: PlayCardType
  gunSize?: number
  damage?: number
}

const shipDeck = (cardsJson as { shipDeck: ShipCard[] }).shipDeck
const playDeck = (cardsJson as { playDeck: PlayCard[] }).playDeck

const shipById = new Map(shipDeck.map((s) => [s.id, s]))
const playById = new Map(playDeck.map((p) => [p.id, p]))

/** Cards that must be resolved the instant they're drawn, and are auto-discarded if there's no legal target. */
export const IMMEDIATE_PLAY_TYPES = new Set<PlayCardType>([
  'minefield',
  'submarine',
  'torpedo_boat',
  'additional_damage',
  'additional_ship',
])

/** Red special cards eligible to be played during the initial setup phase. */
export const SPECIAL_PHASE_TYPES = new Set<PlayCardType>([
  'minefield',
  'submarine',
  'torpedo_boat',
  'additional_damage',
  'additional_ship',
])

export function getShip(id: string): ShipCard {
  const s = shipById.get(id)
  if (!s) throw new Error(`Unknown ship card: ${id}`)
  return s
}

export function getPlayCard(id: string): PlayCard {
  const p = playById.get(id)
  if (!p) throw new Error(`Unknown play card: ${id}`)
  return p
}

export function allShipIds(): string[] {
  return shipDeck.map((s) => s.id)
}

export function allPlayCardIds(): string[] {
  return playDeck.map((p) => p.id)
}

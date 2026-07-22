import cardsJson from '../data/cards.json'

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

export interface ShipCard {
  id: string
  name: string
  country: string
  gunSize: number | null
  hitPoints: number
  isCarrier: boolean
}

export interface PlayCard {
  id: string
  type: PlayCardType
  gunSize?: number
  damage?: number
}

const shipDeck = cardsJson.shipDeck as ShipCard[]
const playDeck = cardsJson.playDeck as PlayCard[]

const shipById = new Map(shipDeck.map((s) => [s.id, s]))
const playById = new Map(playDeck.map((p) => [p.id, p]))

export function getShip(id: string): ShipCard {
  const s = shipById.get(id)
  if (!s) throw new Error(`Unknown ship: ${id}`)
  return s
}

export function getPlayCard(id: string): PlayCard {
  const p = playById.get(id)
  if (!p) throw new Error(`Unknown play card: ${id}`)
  return p
}

export function cardImageUrl(id: string): string {
  return `/cards/${id}.webp`
}

export const CARD_TYPE_LABELS: Record<PlayCardType, string> = {
  salvo: 'Salvo',
  minefield: 'Minefield',
  submarine: 'Submarine',
  torpedo_boat: 'Torpedo Boat',
  additional_damage: 'Additional Damage',
  additional_ship: 'Additional Ship',
  repair: 'Repair',
  minesweeper: 'Minesweeper',
  smoke: 'Smoke',
  destroyer_squadron: 'Destroyer Squadron',
}

export const SPECIAL_PHASE_TYPES = new Set<PlayCardType>([
  'minefield',
  'submarine',
  'torpedo_boat',
  'additional_damage',
  'additional_ship',
])

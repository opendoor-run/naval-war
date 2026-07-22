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

export const CARD_TYPE_DESCRIPTIONS: Record<PlayCardType, string> = {
  salvo: 'Fire at an enemy ship with a matching gun size. Damage stacks until the ship sinks.',
  minefield: "Hits every current ship in a fleet, and any ship added later, until Minesweeper removes it.",
  submarine: 'Roll a die at a target ship; a 5 or 6 sinks it.',
  torpedo_boat: 'Roll a die at a target ship; only a 6 sinks it.',
  additional_damage: 'Adds more hits to a salvo already on an enemy ship. If it finishes the ship off, you get the sink credit.',
  additional_ship: 'Draw a new ship straight from the harbor pile into your own fleet.',
  repair: 'Removes one Salvo (and any Additional Damage on it) from one of your own ships.',
  minesweeper: 'Clears every Minefield in front of your own fleet.',
  smoke: 'Your fleet is immune to everything except Submarines and Additional Damage, until your next turn.',
  destroyer_squadron: 'A public card anyone may fire Salvos at (4 hits destroys it). If it survives to your next turn, it attacks a fleet of your choice.',
}

export const SPECIAL_PHASE_TYPES = new Set<PlayCardType>([
  'minefield',
  'submarine',
  'torpedo_boat',
  'additional_damage',
  'additional_ship',
])

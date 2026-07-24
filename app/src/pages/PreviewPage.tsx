import { useState } from 'react'
import { Lobby } from '../components/Lobby'
import { GameBoard } from '../components/GameBoard'
import { ChatPanel } from '../components/ChatPanel'
import { InstructionsModal } from '../components/InstructionsModal'
import type {
  ChatMessageRow,
  DestroyerSquadronRow,
  GameLogRow,
  GamePlayerRow,
  GameRow,
  HandRow,
  TaskForceRow,
} from '../types/game'

const ME = 'alice'
const BOB = 'bob'
const CAROL = 'carol'
const DAVE = 'dave'

const mockPlayers: GamePlayerRow[] = [
  { game_id: 'preview', user_id: ME, seat_index: 0, display_name: 'Alice (you)', total_score: 34, is_eliminated_this_round: false, is_bot: false },
  { game_id: 'preview', user_id: BOB, seat_index: 1, display_name: 'Bob', total_score: 51, is_eliminated_this_round: false, is_bot: false },
  { game_id: 'preview', user_id: CAROL, seat_index: 2, display_name: 'Carol', total_score: 12, is_eliminated_this_round: false, is_bot: false },
  { game_id: 'preview', user_id: DAVE, seat_index: 3, display_name: 'Dave', total_score: 28, is_eliminated_this_round: false, is_bot: false },
]

const mockGameBoard: GameRow = {
  id: 'preview',
  invite_token: 'preview',
  host_id: ME,
  target_score: 100,
  max_players: 6,
  status: 'in_progress',
  current_round: 2,
  dealer_seat: 1,
  turn_seat: 0,
  special_phase_seat: null,
  draw_count: 42,
  discard_count: 11,
  harbor_count: 19,
  has_pending_card: false,
  drawn_this_turn: false,
  version: 1,
}

const mockGameLobby: GameRow = { ...mockGameBoard, status: 'lobby' }

const mockHand: HandRow = {
  game_id: 'preview',
  user_id: ME,
  cards: ['play-007', 'play-019', 'play-036', 'play-050', 'play-012', 'play-034'],
  pending_card: null,
}

const mockTaskForces: Record<string, TaskForceRow> = {
  [ME]: {
    game_id: 'preview',
    owner_id: ME,
    ships: [
      { shipId: 'ship-nelson', damage: 2, sunk: false, salvos: [{ id: 'play-201', gunSize: 14, damage: 2, firedBy: BOB, additionalDamage: [] }] },
      { shipId: 'ship-iowa', damage: 0, sunk: false, salvos: [] },
      { shipId: 'ship-akagi', damage: 0, sunk: false, salvos: [] },
    ],
    minefields: [],
    smoke_active: false,
    // Deep Six credits the sinker, not the ship's original owner - Alice's pile
    // holds ships SHE has sunk. ship-scheer was sunk earlier this game (round 1,
    // no longer in anyone's current fleet); ship-mutsu is Bob's Mutsu below,
    // which Alice sank this round.
    deep_six: ['ship-scheer', 'ship-mutsu'],
  },
  [BOB]: {
    game_id: 'preview',
    owner_id: BOB,
    ships: [
      { shipId: 'ship-yamato', damage: 5, sunk: false, salvos: [{ id: 'play-202', gunSize: 16, damage: 3, firedBy: ME, additionalDamage: [{ id: 'play-203', damage: 2, playedBy: CAROL }] }] },
      { shipId: 'ship-mutsu', damage: 6, sunk: true, sunkBy: ME, salvos: [] },
    ],
    minefields: [],
    smoke_active: true,
    // Bob's own Mutsu sank (above), but that credit belongs to Alice (sunkBy) -
    // Bob's pile holds ship-hood, which HE sank (Carol's Hood below).
    deep_six: ['ship-hood'],
  },
  [CAROL]: {
    game_id: 'preview',
    owner_id: CAROL,
    ships: [
      { shipId: 'ship-bismarck', damage: 1, sunk: false, salvos: [] },
      { shipId: 'ship-hood', damage: 5, sunk: true, sunkBy: BOB, salvos: [] },
    ],
    minefields: [{ id: 'play-052', damage: 1, placedBy: ME }],
    smoke_active: false,
    deep_six: [],
  },
  [DAVE]: {
    game_id: 'preview',
    owner_id: DAVE,
    ships: [
      { shipId: 'ship-kongo', damage: 0, sunk: false, salvos: [] },
      { shipId: 'ship-scharnhorst', damage: 4, sunk: false, salvos: [{ id: 'play-204', gunSize: 11, damage: 4, firedBy: ME, additionalDamage: [] }] },
    ],
    minefields: [],
    smoke_active: false,
    deep_six: [],
  },
}

const mockDestroyerSquadrons: DestroyerSquadronRow[] = [
  { id: 'sq-1', game_id: 'preview', owner_id: BOB, card_id: 'play-057', hits_taken: 2, created_at: new Date().toISOString() },
]

const mockLog: GameLogRow[] = [
  { id: 1, game_id: 'preview', seat_index: 1, message: 'Round 2 begins. Bob deals.', created_at: '' },
  { id: 2, game_id: 'preview', seat_index: 0, message: 'Alice fired a 16" Salvo at Yamato - 3 hits.', created_at: '' },
  { id: 3, game_id: 'preview', seat_index: 2, message: 'Carol added damage to Yamato - 2 hits.', created_at: '' },
  { id: 4, game_id: 'preview', seat_index: 1, message: "Bob's Destroyer Squadron deployed.", created_at: '' },
  { id: 5, game_id: 'preview', seat_index: 1, message: 'Bob laid down a smoke screen.', created_at: '' },
  { id: 6, game_id: 'preview', seat_index: 0, message: 'Alice laid a minefield in front of Carol\'s fleet.', created_at: '' },
  { id: 7, game_id: 'preview', seat_index: 1, message: "Bob's Mutsu sunk by Alice - eliminated ship.", created_at: '' },
]

const initialMockChat: ChatMessageRow[] = [
  { id: 1, game_id: 'preview', user_id: BOB, message: 'good luck everyone', created_at: '' },
  { id: 2, game_id: 'preview', user_id: CAROL, message: 'you too, watch out for my mines', created_at: '' },
]

export default function PreviewPage() {
  const [view, setView] = useState<'board' | 'lobby'>('board')
  const [chat, setChat] = useState<ChatMessageRow[]>(initialMockChat)
  const [showInstructions, setShowInstructions] = useState(false)

  async function mockDispatch() {
    // No-op: this is a static design preview, not wired to a real backend.
    await new Promise((r) => setTimeout(r, 250))
  }

  async function mockSendMessage(text: string) {
    setChat((prev) => [...prev, { id: prev.length + 1, game_id: 'preview', user_id: ME, message: text, created_at: '' }])
  }

  return (
    <div>
      <div className="fixed left-1/2 top-3 z-50 flex -translate-x-1/2 gap-2 rounded-full border border-white/20 bg-black/70 px-3 py-1.5 text-xs text-white backdrop-blur">
        <span className="text-white/50">Design preview (fake data, no server calls) -</span>
        <button
          onClick={() => setView('board')}
          className={`rounded-full px-2 py-0.5 ${view === 'board' ? 'bg-amber-400 text-black' : 'hover:bg-white/10'}`}
        >
          Board
        </button>
        <button
          onClick={() => setView('lobby')}
          className={`rounded-full px-2 py-0.5 ${view === 'lobby' ? 'bg-amber-400 text-black' : 'hover:bg-white/10'}`}
        >
          Lobby
        </button>
        <button onClick={() => setShowInstructions(true)} className="rounded-full px-2 py-0.5 hover:bg-white/10">
          Instructions
        </button>
      </div>
      {showInstructions && <InstructionsModal onClose={() => setShowInstructions(false)} />}

      {view === 'lobby' ? (
        <>
          <Lobby game={mockGameLobby} players={mockPlayers} isHost />
          <ChatPanel messages={chat} players={mockPlayers} myUserId={ME} onSend={mockSendMessage} sending={false} />
        </>
      ) : (
        <GameBoard
          game={mockGameBoard}
          players={mockPlayers}
          myUserId={ME}
          myHand={mockHand}
          taskForces={mockTaskForces}
          destroyerSquadrons={mockDestroyerSquadrons}
          log={mockLog}
          dispatch={mockDispatch}
          chatMessages={chat}
          onSendChat={mockSendMessage}
          chatSending={false}
        />
      )}
    </div>
  )
}

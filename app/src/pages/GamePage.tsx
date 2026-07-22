import { useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGameData } from '../hooks/useGameData'
import { useChatMessages } from '../hooks/useChatMessages'
import { gameAction } from '../lib/api'
import { Lobby } from '../components/Lobby'
import { GameBoard } from '../components/GameBoard'
import { ChatPanel } from '../components/ChatPanel'

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { user, loading: authLoading } = useAuth()
  const { game, players, myHand, taskForces, destroyerSquadrons, log, loading } = useGameData(gameId, user?.id)
  const { messages, sendMessage, sending } = useChatMessages(gameId, user?.id)

  if (authLoading || loading || !game) {
    return <div className="command-room ptc-mono flex min-h-screen items-center justify-center">Loading...</div>
  }
  const myPlayer = players.find((p) => p.user_id === user?.id)
  if (!myPlayer || !user) {
    return (
      <div className="command-room ptc-mono flex min-h-screen items-center justify-center">
        You're not seated in this game.
      </div>
    )
  }

  return (
    <>
      {game.status === 'lobby' ? (
        <Lobby game={game} players={players} isHost={game.host_id === user.id} />
      ) : (
        <GameBoard
          game={game}
          players={players}
          myUserId={user.id}
          myHand={myHand}
          taskForces={taskForces}
          destroyerSquadrons={destroyerSquadrons}
          log={log}
          dispatch={gameAction}
        />
      )}
      <ChatPanel messages={messages} players={players} myUserId={user.id} onSend={sendMessage} sending={sending} />
    </>
  )
}

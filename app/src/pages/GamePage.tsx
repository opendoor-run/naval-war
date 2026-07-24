import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useGameData } from '../hooks/useGameData'
import { useChatMessages } from '../hooks/useChatMessages'
import { gameAction } from '../lib/api'
import { Lobby } from '../components/Lobby'
import { GameBoard } from '../components/GameBoard'
import { GameOverScreen } from '../components/GameOverScreen'
import { ChatPanel } from '../components/ChatPanel'
import { AppHeader } from '../components/AppHeader'

export default function GamePage() {
  const { gameId } = useParams<{ gameId: string }>()
  const { user, loading: authLoading } = useAuth()
  const { game, players, myHand, taskForces, destroyerSquadrons, log, loading, deleted } = useGameData(gameId, user?.id)
  const { messages, sendMessage, sending } = useChatMessages(gameId, user?.id)

  if (deleted) {
    return (
      <div className="command-room min-h-screen">
        <AppHeader />
        <div className="flex min-h-[calc(100vh-40px)] flex-col items-center justify-center gap-3">
          <p className="ptc-mono">This game was deleted by the host.</p>
          <Link to="/" className="ptc-btn px-4 py-2 text-sm">
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  if (authLoading || loading || !game) {
    return (
      <div className="command-room min-h-screen">
        <AppHeader />
        <p className="ptc-mono flex min-h-[calc(100vh-40px)] items-center justify-center">Loading...</p>
      </div>
    )
  }
  const myPlayer = players.find((p) => p.user_id === user?.id)
  if (!myPlayer || !user) {
    return (
      <div className="command-room min-h-screen">
        <AppHeader />
        <p className="ptc-mono flex min-h-[calc(100vh-40px)] items-center justify-center">
          You're not seated in this game.
        </p>
      </div>
    )
  }

  return (
    <>
      {game.status === 'lobby' ? (
        <>
          <Lobby game={game} players={players} isHost={game.host_id === user.id} />
          <ChatPanel messages={messages} players={players} myUserId={user.id} onSend={sendMessage} sending={sending} />
        </>
      ) : game.status === 'finished' ? (
        <>
          <GameOverScreen game={game} players={players} />
          <ChatPanel messages={messages} players={players} myUserId={user.id} onSend={sendMessage} sending={sending} />
        </>
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
          chatMessages={messages}
          onSendChat={sendMessage}
          chatSending={sending}
        />
      )}
    </>
  )
}

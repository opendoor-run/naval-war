import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import JoinPage from './pages/JoinPage'
import GamePage from './pages/GamePage'
import PreviewPage from './pages/PreviewPage'

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="/game/:gameId" element={<GamePage />} />
      <Route path="/preview" element={<PreviewPage />} />
    </Routes>
  )
}

export default App

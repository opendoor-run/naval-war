import { lazy, Suspense } from 'react'
import { Routes, Route } from 'react-router-dom'
import HomePage from './pages/HomePage'
import JoinPage from './pages/JoinPage'
import GamePage from './pages/GamePage'

// Pure design-preview route (fake data, no server calls) - real players never hit it, so it
// has no business shipping in their initial bundle.
const PreviewPage = lazy(() => import('./pages/PreviewPage'))

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/join/:token" element={<JoinPage />} />
      <Route path="/game/:gameId" element={<GamePage />} />
      <Route
        path="/preview"
        element={
          <Suspense fallback={null}>
            <PreviewPage />
          </Suspense>
        }
      />
    </Routes>
  )
}

export default App

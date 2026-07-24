import { Component, type ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

/** Backstop for render-time crashes (e.g. an unrecognized card id from the server) that
    would otherwise white-screen the whole app with no way back except a manual URL edit. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }) {
    console.error('Unhandled error in render tree:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="command-room flex min-h-screen items-center justify-center p-4">
          <div className="ptc-panel ptc-clipboard ptc-rivets max-w-md p-6 text-center">
            <p className="ptc-headline mb-2 text-lg">Something went wrong</p>
            <p className="ptc-mono mb-4 text-sm text-[var(--ink-soft)]">{this.state.error.message}</p>
            <a href="/" className="ptc-btn px-4 py-2 text-sm">
              Reload
            </a>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

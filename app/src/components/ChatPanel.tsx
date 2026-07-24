import { memo, useEffect, useRef, useState } from 'react'
import type { ChatMessageRow, GamePlayerRow } from '../types/game'

export const ChatPanel = memo(function ChatPanel({
  messages,
  players,
  myUserId,
  onSend,
  sending,
  className = 'fixed bottom-4 right-4 z-40 w-72 max-w-[calc(100vw-2rem)]',
}: {
  messages: ChatMessageRow[]
  players: GamePlayerRow[]
  myUserId: string
  onSend: (text: string) => Promise<void>
  sending: boolean
  /** Positioning wrapper classes - defaults to a fixed bottom-right overlay (Lobby, Game Over).
      Pass '' when embedding in a normal flex/grid layout (in-game sidebar) so it reflows with
      its siblings instead of floating independently. */
  className?: string
}) {
  const [open, setOpen] = useState(true)
  const [draft, setDraft] = useState('')
  const listRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) listRef.current?.scrollTo({ top: listRef.current.scrollHeight })
  }, [messages, open])

  function nameFor(userId: string): string {
    if (userId === myUserId) return 'You'
    return players.find((p) => p.user_id === userId)?.display_name ?? 'Unknown'
  }

  async function handleSend() {
    if (!draft.trim()) return
    const text = draft
    setDraft('')
    await onSend(text)
  }

  return (
    <div className={className}>
      <div className="ptc-panel overflow-hidden">
        <button onClick={() => setOpen((o) => !o)} className="ptc-headline flex w-full items-center justify-between px-3 py-2 text-sm hover:bg-[var(--parchment-lo)]/40">
          <span>Radio</span>
          <span>{open ? '▾' : '▸'}</span>
        </button>

        {open && (
          <>
            <div ref={listRef} className="ptc-mono max-h-64 space-y-1.5 overflow-y-auto border-t border-[var(--navy-deep)] px-3 py-2 text-sm">
              {messages.length === 0 && <p className="text-xs text-[var(--ink-soft)]">No messages yet.</p>}
              {messages.map((m) => (
                <p key={m.id} className="leading-snug text-[var(--ink)]">
                  <span className="font-bold" style={{ color: m.user_id === myUserId ? 'var(--red)' : 'var(--navy)' }}>
                    {nameFor(m.user_id)}:
                  </span>{' '}
                  {m.message}
                </p>
              ))}
            </div>
            <div className="flex gap-1.5 border-t border-[var(--navy-deep)] p-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Say something..."
                maxLength={500}
                className="ptc-input min-w-0 flex-1 text-sm"
              />
              <button onClick={handleSend} disabled={sending || !draft.trim()} className="ptc-btn ptc-btn-primary shrink-0 px-3 py-1 text-sm">
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
})

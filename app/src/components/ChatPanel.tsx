import { useEffect, useRef, useState } from 'react'
import type { ChatMessageRow, GamePlayerRow } from '../types/game'

export function ChatPanel({
  messages,
  players,
  myUserId,
  onSend,
  sending,
}: {
  messages: ChatMessageRow[]
  players: GamePlayerRow[]
  myUserId: string
  onSend: (text: string) => Promise<void>
  sending: boolean
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
    <div className="fixed bottom-4 right-4 z-40 w-72 max-w-[calc(100vw-2rem)]">
      <div className="overflow-hidden rounded-xl border border-white/15 bg-black/80 shadow-xl backdrop-blur">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center justify-between px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/5"
        >
          <span>Chat</span>
          <span className="text-white/40">{open ? '▾' : '▸'}</span>
        </button>

        {open && (
          <>
            <div ref={listRef} className="max-h-64 space-y-1.5 overflow-y-auto border-t border-white/10 px-3 py-2 text-sm">
              {messages.length === 0 && <p className="text-xs text-white/40">No messages yet.</p>}
              {messages.map((m) => (
                <p key={m.id} className="leading-snug text-white/90">
                  <span className={m.user_id === myUserId ? 'font-semibold text-amber-300' : 'font-semibold text-white/70'}>
                    {nameFor(m.user_id)}:
                  </span>{' '}
                  {m.message}
                </p>
              ))}
            </div>
            <div className="flex gap-1.5 border-t border-white/10 p-2">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="Say something..."
                maxLength={500}
                className="min-w-0 flex-1 rounded-md border border-white/20 bg-white/10 px-2 py-1 text-sm text-white placeholder-white/40 outline-none focus:border-amber-300"
              />
              <button
                onClick={handleSend}
                disabled={sending || !draft.trim()}
                className="shrink-0 rounded-md bg-amber-400 px-3 py-1 text-sm font-semibold text-black hover:bg-amber-300 disabled:opacity-40"
              >
                Send
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

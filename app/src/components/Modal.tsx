import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export function Modal({
  title,
  onClose,
  children,
}: {
  title: string
  onClose: () => void
  children: React.ReactNode
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--navy-deep)]/80 p-4" onClick={onClose}>
      <div
        className="ptc-panel flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--navy-deep)] bg-[var(--navy-deep)] px-5 py-3">
          <h2 className="ptc-display text-lg" style={{ color: 'var(--parchment-hi)', textShadow: 'none' }}>
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close"
            className="ptc-mono px-2 py-1 text-[var(--parchment-hi)] hover:opacity-70"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>,
    document.body
  )
}

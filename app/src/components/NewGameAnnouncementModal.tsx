'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useWallet } from '@alephium/web3-react'
import { useEmbeddedWallet } from '@/embed/EmbeddedWalletContext'

// Bump this string to re-announce to everyone who previously dismissed.
const ANNOUNCEMENT_KEY = 'bb:announce:guess:v1'

function hasBeenDismissed(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return window.localStorage.getItem(ANNOUNCEMENT_KEY) === '1'
  } catch {
    return false
  }
}

function markDismissed() {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(ANNOUNCEMENT_KEY, '1')
  } catch {
    // ignore storage failures (private mode, disabled storage, …)
  }
}

/**
 * One-time promo modal that pops the first time a wallet is connected on the
 * home page. Dismissal is persisted in localStorage so users only ever see
 * it once per device until we bump ANNOUNCEMENT_KEY.
 */
export const NewGameAnnouncementModal: React.FC = () => {
  const { account: walletAccount } = useWallet()
  const { address: embeddedAddress, isEmbeddedWallet } = useEmbeddedWallet()
  const isConnected = isEmbeddedWallet ? !!embeddedAddress : !!walletAccount

  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!isConnected) return
    if (hasBeenDismissed()) return
    // Small delay so it doesn't flash at the exact moment the wallet
    // connect flow finishes closing its own UI.
    const t = setTimeout(() => setOpen(true), 400)
    return () => clearTimeout(t)
  }, [isConnected])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  function close() {
    markDismissed()
    setOpen(false)
  }

  if (!open) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-game-announcement-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8 bg-black/60 backdrop-blur-sm"
      onClick={close}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-card-border bg-card-bg p-6 shadow-2xl flex flex-col gap-4"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close announcement"
          className="absolute top-3 right-3 w-8 h-8 rounded-full text-muted hover:text-page-heading hover:bg-stat-card-bg transition-colors flex items-center justify-center"
        >
          ×
        </button>

        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-status-warning-bg text-status-claimable">
            New game
          </span>
          <span className="text-[10px] text-muted uppercase tracking-wider">
            Just launched
          </span>
        </div>

        <h2
          id="new-game-announcement-title"
          className="text-2xl font-bold text-page-heading leading-tight"
        >
          Number Guessing War
        </h2>

        <p className="text-sm text-label">
          Pick a number and try to land closest to a random target.
          The target is drawn from a tamper-proof public randomness beacon
          after the room locks, so nobody — not players, not miners — can
          rig the draw. The closer your guess, the bigger your share of the pot.
        </p>

        <ul className="text-xs text-muted space-y-1 pl-1">
          <li><span className="text-page-heading font-medium">Exact hit</span> → 2.0× entry fee</li>
          <li><span className="text-page-heading font-medium">Top 5%</span> → 1.5×</li>
          <li><span className="text-page-heading font-medium">Top 20%</span> → 1.2×</li>
        </ul>

        <div className="flex items-center gap-2 pt-2">
          <Link
            href="/guess"
            onClick={close}
            className="flex-1 px-4 py-2.5 text-sm font-medium rounded-xl bg-primary text-primary-fg hover:bg-primary-hover transition-colors text-center"
          >
            Try it now
          </Link>
          <Link
            href="/how-to-play"
            onClick={close}
            className="px-4 py-2.5 text-sm font-medium rounded-xl border border-card-border text-nav-link hover:bg-stat-card-bg transition-colors"
          >
            Rules
          </Link>
        </div>

        <button
          type="button"
          onClick={close}
          className="text-xs text-muted hover:text-page-heading transition-colors self-center"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}

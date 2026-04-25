'use client'

import React, { FC, useState } from 'react'
import { RoomInfo, roomStateLabel, formatAlph, ROOM_STATE_OPEN, ROOM_STATE_CLAIMABLE, ROOM_STATE_EXPIRED } from '@/services/guess.service'

function stateColor(state: bigint): string {
  if (state === ROOM_STATE_OPEN) return 'text-status-success-text bg-status-success-bg'
  if (ROOM_STATE_CLAIMABLE === state) return 'text-status-claimable bg-status-warning-bg'
  if (state === ROOM_STATE_EXPIRED) return 'text-muted bg-stat-card-bg'
  return 'text-status-warning bg-status-warning-bg'
}

function expiresLabel(expiresAt: bigint): string {
  const ms = Number(expiresAt) - Date.now()
  if (ms <= 0) return 'Expired'
  const h = Math.floor(ms / 3_600_000)
  const m = Math.floor((ms % 3_600_000) / 60_000)
  if (h > 0) return `${h}h ${m}m`
  return `${m}m`
}

interface Props {
  room: RoomInfo
  isSelected: boolean
  onClick: () => void
}

export const RoomCard: FC<Props> = ({ room, isSelected, onClick }) => {
  const [copied, setCopied] = useState(false)

  const filledPct = room.maxPlayers > 0n
    ? Number((room.playerCount * 100n) / room.maxPlayers)
    : 0

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation()
    const link = `${window.location.origin}/guess?address=${room.address}`
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={handleKeyDown}
      className={`w-full text-left p-4 rounded-2xl border transition-colors cursor-pointer ${
        isSelected
          ? 'border-primary bg-accent'
          : 'border-card-border bg-card-bg hover:border-card-hover-border'
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${stateColor(room.state)}`}>
              {roomStateLabel(room.state)}
            </span>
            <span className="text-xs text-muted truncate font-mono">
              {room.contractId.slice(0, 8)}…
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span className="text-sm font-bold text-page-heading">
              {formatAlph(room.entryFee)} ALPH
            </span>
            <span className="text-xs text-muted">
              1–{room.numberRangeMax.toString()}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="text-[10px] text-muted hover:text-muted-hover transition-colors"
              title="Copy shareable link"
            >
              {copied ? '✓' : '🔗'}
            </button>
            <span className="text-xs text-muted">
              {room.playerCount.toString()}/{room.maxPlayers.toString()} players
            </span>
          </div>
          {room.state === ROOM_STATE_OPEN && (
            <span className="text-[10px] text-muted">
              {expiresLabel(room.expiresAt)}
            </span>
          )}
          {room.state === ROOM_STATE_CLAIMABLE && (
            <span className="text-[10px] font-medium text-status-claimable">
              Target: {room.target.toString()}
            </span>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="mt-2 h-1 rounded-full bg-stat-card-bg overflow-hidden">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${filledPct}%` }}
        />
      </div>

      <div className="mt-1.5 flex items-center justify-between">
        <span className="text-[10px] text-muted">
          Pot: {formatAlph(room.pot)} ALPH
        </span>
        {room.state === ROOM_STATE_OPEN && filledPct < 100 && (
          <span className="text-[10px] text-primary font-medium">Join →</span>
        )}
      </div>
    </div>
  )
}

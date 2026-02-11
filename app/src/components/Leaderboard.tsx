'use client'

import React, { FC, useState } from 'react'
import { PlayerStats, LeaderboardSort } from '@/hooks/useLeaderboard'
import { formatAlph, shortenAddress, normalizeAddress } from '@/services/game.service'

interface LeaderboardProps {
  data: PlayerStats[]
  isLoading: boolean
  currentUserAddress?: string
}

const sortOptions: { key: LeaderboardSort; label: string }[] = [
  { key: 'totalPayout', label: 'Profit' },
  { key: 'wins', label: 'Wins' },
  { key: 'gamesPlayed', label: 'Plays' },
]

export const Leaderboard: FC<LeaderboardProps> = ({ data, isLoading, currentUserAddress }) => {
  const [sortBy, setSortBy] = useState<LeaderboardSort>('totalPayout')

  const sorted = [...data].sort((a, b) => {
    switch (sortBy) {
      case 'wins': return b.wins - a.wins
      case 'totalPayout': return Number((b.totalPayout - b.totalSpent) - (a.totalPayout - a.totalSpent))
      case 'gamesPlayed': return b.gamesPlayed - a.gamesPlayed
    }
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-muted">Loading events...</p>
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <p className="text-center text-muted py-12">
        No games played yet. Be the first!
      </p>
    )
  }

  return (
    <div className="w-full flex flex-col gap-4">
      <div className="flex justify-center gap-2">
        {sortOptions.map(opt => (
          <button
            key={opt.key}
            onClick={() => setSortBy(opt.key)}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              sortBy === opt.key
                ? 'bg-primary text-primary-fg'
                : 'bg-stat-card-bg text-btn-outline-text hover:bg-btn-outline-border'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {sorted.slice(0, 10).map((player, i) => {
          const rank = i + 1
          const isCurrentUser = currentUserAddress ? normalizeAddress(currentUserAddress) === normalizeAddress(player.address) : false
          return (
            <div
              key={player.address}
              className={`flex items-center gap-3 p-3 rounded-xl border ${
                isCurrentUser
                  ? 'bg-status-success-bg border-stat-card-accent-border'
                  : 'bg-stat-card-bg border-card-border'
              }`}
            >
              <span className={`w-7 text-center text-sm font-bold ${
                rank === 1 ? 'text-status-claimable' :
                rank === 2 ? 'text-muted' :
                rank === 3 ? 'text-countdown-warning' :
                'text-label'
              }`}>
                {rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isCurrentUser ? 'text-primary' : 'text-page-heading'}`}>
                  {isCurrentUser ? 'You' : shortenAddress(player.address)}
                </p>
              </div>
              <div className="grid grid-cols-4 gap-2 text-right w-[280px] shrink-0">
                <div className="flex flex-col">
                  <span className="text-[10px] text-label uppercase">Wins</span>
                  <span className="text-sm font-bold text-page-heading">{player.wins}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-label uppercase">Spent</span>
                  <span className="text-sm font-bold text-page-heading">{formatAlph(player.totalSpent)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-label uppercase">Profit</span>
                  <span className={`text-sm font-bold ${player.totalPayout > player.totalSpent ? 'text-status-success-text' : player.totalPayout < player.totalSpent ? 'text-burn-value' : 'text-page-heading'}`}>
                    {player.totalPayout >= player.totalSpent
                      ? formatAlph(player.totalPayout - player.totalSpent)
                      : `-${formatAlph(player.totalSpent - player.totalPayout)}`}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-label uppercase">Plays</span>
                  <span className="text-sm font-bold text-page-heading">{player.gamesPlayed}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

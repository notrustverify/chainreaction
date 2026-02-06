'use client'

import React, { FC, useState } from 'react'
import { PlayerStats, LeaderboardSort } from '@/hooks/useLeaderboard'
import { formatAlph, shortenAddress } from '@/services/game.service'

interface LeaderboardProps {
  data: PlayerStats[]
  isLoading: boolean
  currentUserAddress?: string
}

const sortOptions: { key: LeaderboardSort; label: string }[] = [
  { key: 'totalPayout', label: 'Payout' },
  { key: 'wins', label: 'Wins' },
  { key: 'gamesPlayed', label: 'Games' },
]

export const Leaderboard: FC<LeaderboardProps> = ({ data, isLoading, currentUserAddress }) => {
  const [sortBy, setSortBy] = useState<LeaderboardSort>('totalPayout')

  const sorted = [...data].sort((a, b) => {
    switch (sortBy) {
      case 'wins': return b.wins - a.wins
      case 'totalPayout': return Number(b.totalPayout - a.totalPayout)
      case 'gamesPlayed': return b.gamesPlayed - a.gamesPlayed
    }
  })

  if (isLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-12">
        <div className="w-8 h-8 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-400">Loading events...</p>
      </div>
    )
  }

  if (sorted.length === 0) {
    return (
      <p className="text-center text-gray-400 py-12">
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
                ? 'bg-emerald-500 text-white'
                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        {sorted.map((player, i) => {
          const rank = i + 1
          const isCurrentUser = currentUserAddress === player.address
          return (
            <div
              key={player.address}
              className={`flex items-center gap-3 p-3 rounded-xl border ${
                isCurrentUser
                  ? 'bg-emerald-50 border-emerald-200'
                  : 'bg-gray-50 border-gray-100'
              }`}
            >
              <span className={`w-7 text-center text-sm font-bold ${
                rank === 1 ? 'text-amber-500' :
                rank === 2 ? 'text-gray-400' :
                rank === 3 ? 'text-orange-400' :
                'text-gray-300'
              }`}>
                {rank}
              </span>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${isCurrentUser ? 'text-emerald-600' : 'text-gray-900'}`}>
                  {isCurrentUser ? 'You' : shortenAddress(player.address)}
                </p>
              </div>
              <div className="flex gap-4 text-right">
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase">Wins</span>
                  <span className="text-sm font-bold text-gray-900">{player.wins}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase">Payout</span>
                  <span className="text-sm font-bold text-gray-900">{formatAlph(player.totalPayout)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 uppercase">Games</span>
                  <span className="text-sm font-bold text-gray-900">{player.gamesPlayed}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

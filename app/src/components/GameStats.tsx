'use client'

import React, { FC } from 'react'
import { formatAlph, shortenAddress } from '@/services/game.service'

interface GameStatsProps {
  pot: bigint
  entryPrice: bigint
  playerCount: bigint
  lastPlayer: string
  chainId: bigint
  multiplierBps: bigint
  currentUserAddress?: string
}

export const GameStats: FC<GameStatsProps> = ({
  pot, entryPrice, playerCount, lastPlayer, chainId, multiplierBps, currentUserAddress
}) => {
  const multiplierPct = Number(multiplierBps) / 100
  const isCurrentUserLast = currentUserAddress === lastPlayer

  return (
    <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
      <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
        <span className="text-[11px] text-gray-400 uppercase tracking-wider">Pot</span>
        <span className="text-lg font-bold text-gray-900 mt-1">{formatAlph(pot)} ALPH</span>
      </div>
      <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
        <span className="text-[11px] text-gray-400 uppercase tracking-wider">Next Entry</span>
        <span className="text-lg font-bold text-gray-900 mt-1">{formatAlph(entryPrice)} ALPH</span>
      </div>
      <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
        <span className="text-[11px] text-gray-400 uppercase tracking-wider">Players</span>
        <span className="text-lg font-bold text-gray-900 mt-1">{playerCount.toString()}</span>
      </div>
      <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
        <span className="text-[11px] text-gray-400 uppercase tracking-wider">Last Player</span>
        <span className={`text-lg font-bold mt-1 ${isCurrentUserLast ? 'text-emerald-500' : 'text-gray-900'}`}>
          {isCurrentUserLast ? 'You!' : shortenAddress(lastPlayer)}
        </span>
      </div>
      <div className="col-span-2 text-center text-xs text-gray-400 pt-1">
        Chain #{chainId.toString()} &middot; +{multiplierPct}% per join
      </div>
    </div>
  )
}

'use client'

import React, { FC } from 'react'
import { shortenAddress } from '@/services/game.service'
import { formatTokenAmount } from '@/services/tokenList'

interface GameStatsProps {
  pot: bigint
  boostAmount: bigint
  entryPrice: bigint
  lastPlayer: string
  playerCount: bigint
  multiplierBps: bigint
  burnedAmount: bigint
  burnBps: bigint
  currentUserAddress?: string
  tokenSymbol: string
  tokenDecimals: number
}

export const GameStats: FC<GameStatsProps> = ({
  pot, boostAmount, entryPrice, lastPlayer, playerCount, multiplierBps, burnedAmount, burnBps, currentUserAddress, tokenSymbol, tokenDecimals
}) => {
  const multiplierPct = Number(multiplierBps) / 100
  const burnPct = Number(burnBps) / 100
  const isCurrentUserLast = currentUserAddress === lastPlayer
  const totalPrize = pot + boostAmount

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <div className="flex flex-col items-center p-5 bg-gray-50 rounded-xl border border-gray-100">
        <span className="text-[11px] text-gray-400 uppercase tracking-wider">Pot</span>
        <span className="text-2xl font-bold text-gray-900 mt-1">{formatTokenAmount(totalPrize, tokenDecimals)} {tokenSymbol}</span>
        {boostAmount > 0n && (
          <span className="text-xs text-emerald-500 mt-1">
            incl. {formatTokenAmount(boostAmount, tokenDecimals)} {tokenSymbol} boosted
          </span>
        )}
        {burnedAmount > 0n && (
          <span className="text-xs text-red-500 mt-1">
            {formatTokenAmount(burnedAmount, tokenDecimals)} {tokenSymbol} burned
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-[11px] text-gray-400 uppercase tracking-wider">Next Entry</span>
          <span className="text-lg font-bold text-gray-900 mt-1">{formatTokenAmount(entryPrice, tokenDecimals)} {tokenSymbol}</span>
        </div>
        <div className="flex flex-col items-center p-4 bg-gray-50 rounded-xl border border-gray-100">
          <span className="text-[11px] text-gray-400 uppercase tracking-wider">Last Player</span>
          <span className={`text-lg font-bold mt-1 ${isCurrentUserLast ? 'text-emerald-500' : 'text-gray-900'}`}>
            {isCurrentUserLast ? 'You!' : shortenAddress(lastPlayer)}
          </span>
        </div>
      </div>
      <div className="text-center text-xs text-gray-400">
        {playerCount.toString()} {playerCount === 1n ? 'play' : 'plays'} &middot; +{multiplierPct}% per play
        {burnBps > 0n && <> &middot; {burnPct}% burned</>}
      </div>
    </div>
  )
}

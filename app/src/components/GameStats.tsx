'use client'

import React, { FC } from 'react'
import { shortenAddress, normalizeAddress } from '@/services/game.service'
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
  const isCurrentUserLast = currentUserAddress ? normalizeAddress(currentUserAddress) === normalizeAddress(lastPlayer) : false
  const totalPrize = pot + boostAmount

  return (
    <div className="flex flex-col gap-3 w-full max-w-sm">
      <div className="flex flex-col items-center p-6 stat-card-accent rounded-2xl border shadow-[0_0_40px_color-mix(in_srgb,var(--color-primary)_10%,transparent)]">
        <span className="text-[11px] text-primary uppercase tracking-wider font-medium opacity-80">Prize Pool</span>
        <span className="text-3xl font-black text-page-heading mt-1">{formatTokenAmount(totalPrize, tokenDecimals)} {tokenSymbol}</span>
        {boostAmount > 0n && (
          <span className="text-xs text-primary mt-1">
            incl. {formatTokenAmount(boostAmount, tokenDecimals)} {tokenSymbol} boosted
          </span>
        )}
        {burnedAmount > 0n && (
          <span className="text-xs text-burn-value mt-1">
            {formatTokenAmount(burnedAmount, tokenDecimals)} {tokenSymbol} burned
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center p-4 bg-stat-card-bg rounded-xl border border-card-border">
          <span className="text-[11px] text-label uppercase tracking-wider">Next Entry</span>
          <span className="text-lg font-bold text-page-heading mt-1">{formatTokenAmount(entryPrice, tokenDecimals)} {tokenSymbol}</span>
        </div>
        <div className="flex flex-col items-center p-4 bg-stat-card-bg rounded-xl border border-card-border">
          <span className="text-[11px] text-label uppercase tracking-wider">Last Player</span>
          <span className={`text-lg font-bold mt-1 ${isCurrentUserLast ? 'text-primary' : 'text-page-heading'}`}>
            {isCurrentUserLast ? 'You!' : shortenAddress(lastPlayer)}
          </span>
        </div>
      </div>
      <div className="text-center text-xs text-muted">
        {playerCount.toString()} {playerCount === 1n ? 'play' : 'plays'} &middot; +{multiplierPct}% per play
        {burnBps > 0n && <> &middot; {burnPct}% burned</>}
      </div>
    </div>
  )
}

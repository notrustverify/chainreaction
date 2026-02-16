'use client'

import React, { FC, useState, useEffect } from 'react'
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
  decayPeriodMs: bigint
  currentEntry: bigint
  baseEntry: bigint
  lastEntryTimestamp: bigint
  currentUserAddress?: string
  tokenSymbol: string
  tokenDecimals: number
}

function formatDuration(ms: number): string {
  if (ms <= 0) return '0s'
  const totalSec = Math.ceil(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  if (m > 0) return `${m}m ${s}s`
  return `${s}s`
}

function computeDecayedPrice(
  currentEntry: bigint,
  baseEntry: bigint,
  multiplierBps: bigint,
  lastEntryTimestamp: bigint,
  decayPeriodMs: bigint,
  now: number
): { decayedNextEntry: bigint; remainingMs: number } {
  if (decayPeriodMs <= 0n || currentEntry <= baseEntry) {
    return { decayedNextEntry: currentEntry + (currentEntry * multiplierBps / 10000n), remainingMs: 0 }
  }
  const elapsed = BigInt(now) - lastEntryTimestamp
  const excess = currentEntry - baseEntry
  let effective: bigint
  if (elapsed >= decayPeriodMs) {
    effective = baseEntry
  } else {
    effective = currentEntry - (excess * elapsed / decayPeriodMs)
  }
  if (effective < baseEntry) effective = baseEntry
  const remainingMs = effective > baseEntry ? Number(decayPeriodMs - elapsed) : 0
  const nextEntry = effective + (effective * multiplierBps / 10000n)
  return { decayedNextEntry: nextEntry, remainingMs: Math.max(0, remainingMs) }
}

export const GameStats: FC<GameStatsProps> = ({
  pot, boostAmount, entryPrice, lastPlayer, playerCount, multiplierBps,
  burnedAmount, burnBps, decayPeriodMs, currentEntry, baseEntry, lastEntryTimestamp,
  currentUserAddress, tokenSymbol, tokenDecimals,
}) => {
  const multiplierPct = Number(multiplierBps) / 100
  const burnPct = Number(burnBps) / 100
  const isCurrentUserLast = currentUserAddress ? normalizeAddress(currentUserAddress) === normalizeAddress(lastPlayer) : false
  const totalPrize = pot + boostAmount

  const hasDecay = decayPeriodMs > 0n && currentEntry > baseEntry

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!hasDecay) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [hasDecay])

  const decay = hasDecay
    ? computeDecayedPrice(currentEntry, baseEntry, multiplierBps, lastEntryTimestamp, decayPeriodMs, now)
    : null

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
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col items-center p-4 bg-stat-card-bg rounded-xl border border-card-border">
          <span className="text-[11px] text-label uppercase tracking-wider">Next Entry</span>
          <span className="text-lg font-bold text-page-heading mt-1">{formatTokenAmount(entryPrice, tokenDecimals)} {tokenSymbol}</span>
          {decay && decay.remainingMs > 0 && (
            <div className="flex flex-col items-center mt-1.5 gap-0.5">
              <span className="text-[10px] text-muted">
                decays to {formatTokenAmount(baseEntry + (baseEntry * multiplierBps / 10000n), tokenDecimals)} {tokenSymbol}
              </span>
              <span className="text-[10px] text-primary font-medium">
                in {formatDuration(decay.remainingMs)}
              </span>
            </div>
          )}
          {decay && decay.remainingMs === 0 && decayPeriodMs > 0n && (
            <span className="text-[10px] text-muted mt-1">fully decayed</span>
          )}
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
        {decayPeriodMs > 0n && <> &middot; price decays over {Math.round(Number(decayPeriodMs) / 60000)}m</>}
      </div>
    </div>
  )
}

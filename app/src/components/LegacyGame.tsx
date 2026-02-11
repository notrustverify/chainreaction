'use client'

import React, { FC, useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { fetchV1GameState, GameState, shortenAddress } from '@/services/game.service'
import { formatTokenAmount } from '@/services/tokenList'
import { useThemeForcedParam, useTokensParam, appendPreservedParamsToHref } from '@/theme/useThemeForcedParam'

export const LegacyGame: FC<{ address: string }> = ({ address }) => {
  const themeParam = useThemeForcedParam()
  const tokensParam = useTokensParam()
  const preserved = { theme: themeParam, tokens: tokensParam }
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true

    const poll = async () => {
      try {
        const state = await fetchV1GameState(address)
        if (mountedRef.current) {
          setGameState(state)
          setIsLoading(false)
        }
      } catch {
        if (mountedRef.current) setIsLoading(false)
      }
    }

    poll()
    const interval = setInterval(poll, 15000)

    return () => {
      mountedRef.current = false
      clearInterval(interval)
    }
  }, [address])

  // Hide if loaded and no active game
  if (!isLoading && (!gameState || !gameState.isActive)) return null

  return (
    <Link
      href={appendPreservedParamsToHref(`/game?address=${address}`, preserved)}
      className="group w-full p-4 rounded-2xl border border-status-legacy-border bg-status-legacy-bg hover:border-status-legacy-border hover:shadow-sm transition-all"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-page-heading">Legacy Game (v1)</span>
          {isLoading ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-muted bg-stat-card-bg">
              Loading...
            </span>
          ) : (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full text-status-success-text bg-status-success-bg">
              Active
            </span>
          )}
        </div>
        <span className="text-xs text-muted group-hover:text-status-claimable transition-colors">
          Play &rarr;
        </span>
      </div>

      {gameState && gameState.isActive && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
          <div className="text-muted">
            Pot: <span className="text-fg font-medium">{formatTokenAmount(gameState.pot + gameState.boostAmount, 18)} ALPH</span>
          </div>
          <div className="text-muted">
            Players: <span className="text-fg font-medium">{gameState.playerCount.toString()}</span>
          </div>
          <div className="text-muted">
            Entry: <span className="text-fg font-medium">{formatTokenAmount(gameState.nextEntryPrice, 18)} ALPH</span>
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted mt-2 truncate">{shortenAddress(address)}</p>
    </Link>
  )
}

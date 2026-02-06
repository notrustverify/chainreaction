'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChainReactionInstance } from 'my-contracts'
import { fetchGameState, GameState } from '@/services/game.service'

const POLL_INTERVAL_MS = 4000

export function useChainReaction(contract: ChainReactionInstance) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const refresh = useCallback(async () => {
    try {
      const state = await fetchGameState(contract)
      setGameState(state)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch game state')
    } finally {
      setIsLoading(false)
    }
  }, [contract])

  useEffect(() => {
    refresh()
    intervalRef.current = setInterval(refresh, POLL_INTERVAL_MS)
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [refresh])

  return { gameState, isLoading, error, refresh }
}

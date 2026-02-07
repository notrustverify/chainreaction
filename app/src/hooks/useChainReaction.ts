'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { ChainReactionInstance } from 'my-contracts'
import { fetchGameState, GameState } from '@/services/game.service'

const FALLBACK_POLL_MS = 15000

export function useChainReaction(contract: ChainReactionInstance) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    try {
      const state = await fetchGameState(contract)
      if (mountedRef.current) {
        setGameState(state)
        setError(null)
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Failed to fetch game state')
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false)
      }
    }
  }, [contract])

  useEffect(() => {
    mountedRef.current = true

    // Initial fetch
    refresh()

    // Get current event count and subscribe from there (optimization to skip historical events)
    let subscription: any
    contract.getContractEventsCurrentCount()
      .then((currentCount: number) => {
        if (!mountedRef.current) return

        // Subscribe to contract events for real-time updates, starting from current count
        subscription = contract.subscribeAllEvents({
          pollingInterval: 4000,
          messageCallback: async (event) => {
            if (!mountedRef.current) return
            if (
              event.name === 'PlayerJoined' ||
              event.name === 'ChainStarted' ||
              event.name === 'ChainEnded' ||
              event.name === 'ChainTimeout' ||
              event.name === 'PotBoosted'
            ) {
              await refresh()
            }
          },
          errorCallback: async () => {
            // Silently ignore event subscription errors
          },
        }, currentCount)
      })
      .catch(() => {
        // Fallback: subscribe from beginning if getting event count fails
        if (!mountedRef.current) return
        subscription = contract.subscribeAllEvents({
          pollingInterval: 4000,
          messageCallback: async (event) => {
            if (!mountedRef.current) return
            if (
              event.name === 'PlayerJoined' ||
              event.name === 'ChainStarted' ||
              event.name === 'ChainEnded' ||
              event.name === 'ChainTimeout' ||
              event.name === 'PotBoosted'
            ) {
              await refresh()
            }
          },
          errorCallback: async () => {
            // Silently ignore event subscription errors
          },
        })
      })

    // Fallback poll for non-event changes (e.g. incentive, timer expiry)
    const fallbackInterval = setInterval(refresh, FALLBACK_POLL_MS)

    return () => {
      mountedRef.current = false
      if (subscription) {
        subscription.unsubscribe()
      }
      clearInterval(fallbackInterval)
    }
  }, [contract, refresh])

  return { gameState, isLoading, error, refresh }
}

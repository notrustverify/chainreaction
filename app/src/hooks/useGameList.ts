'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { addressFromContractId } from '@alephium/web3'
import { FactoryChainReactionInstance, ChainReaction } from 'my-contracts'
import { GameContractInstance, fetchGameState, GameState } from '@/services/game.service'
import { TokenInfo, ALPH_TOKEN, resolveTokenInfo } from '@/services/tokenList'

export interface GameListItem {
  contractId: string
  address: string
  gameId: number
  instance: GameContractInstance
  state: GameState | null
  tokenInfo: TokenInfo
}

export function useGameList(factory: FactoryChainReactionInstance) {
  const gamesRef = useRef<Map<string, GameListItem>>(new Map())
  const [version, setVersion] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    gamesRef.current = new Map()
    const seen = new Set<string>()

    const sub = factory.subscribeNewGameCreatedEvent({
      pollingInterval: 4000,
      messageCallback: async (event) => {
        if (cancelled) return

        const eventKey = `${event.txId}:${event.eventIndex}`
        if (seen.has(eventKey)) return
        seen.add(eventKey)

        const contractId = event.fields.contractId
        const gameId = Number(event.fields.gameId)
        const address = addressFromContractId(contractId)
        const instance = ChainReaction.at(address)

        let state: GameState | null = null
        let tokenInfo: TokenInfo = ALPH_TOKEN
        try {
          state = await fetchGameState(instance)
          if (state) tokenInfo = await resolveTokenInfo(state.tokenId)
        } catch {
          // Game contract may not be ready yet
        }

        if (!cancelled) {
          gamesRef.current.set(contractId, { contractId, address, gameId, instance, state, tokenInfo })
          setVersion(v => v + 1)
          setIsLoading(false)
        }
      },
      errorCallback: async (err) => {
        if (!cancelled) {
          setError(String(err))
          setIsLoading(false)
        }
      },
    }, 0)

    // If no events exist, stop loading after a delay
    const timeout = setTimeout(() => {
      if (!cancelled) setIsLoading(false)
    }, 5000)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      sub.unsubscribe()
    }
  }, [factory])

  // Refresh game states periodically
  useEffect(() => {
    const interval = setInterval(async () => {
      let updated = false
      for (const [key, game] of gamesRef.current) {
        try {
          const state = await fetchGameState(game.instance)
          const tokenInfo = state ? await resolveTokenInfo(state.tokenId) : game.tokenInfo
          gamesRef.current.set(key, { ...game, state, tokenInfo })
          updated = true
        } catch {
          // ignore
        }
      }
      if (updated) setVersion(v => v + 1)
    }, 15000)

    return () => clearInterval(interval)
  }, [])

  const games = useMemo(() => {
    return Array.from(gamesRef.current.values()).sort((a, b) => b.gameId - a.gameId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return { games, isLoading, error }
}
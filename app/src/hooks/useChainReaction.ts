'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { web3 } from '@alephium/web3'
import { ChainReactionTypes } from 'my-contracts'
import { GameContractInstance, fetchGameState, GameState, normalizeAddress } from '@/services/game.service'
import { ALPH_TOKEN } from '@/services/tokenList'

export interface PlayerEntry {
  position: number
  address: string
}

const FALLBACK_POLL_MS = 15000

export function useChainReaction(contract: GameContractInstance) {
  const [gameState, setGameState] = useState<GameState | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [players, setPlayers] = useState<PlayerEntry[]>([])
  const [burnsByToken, setBurnsByToken] = useState<Map<string, bigint>>(new Map())
  const mountedRef = useRef(true)
  const playersRef = useRef<Map<string, PlayerEntry>>(new Map())
  const seenEventsRef = useRef<Set<string>>(new Set())
  const burnSeenRef = useRef<Set<string>>(new Set())
  const burnsByTokenRef = useRef<Map<string, bigint>>(new Map())
  const chainTokenMapRef = useRef<Map<string, string>>(new Map())
  const pendingBurnsRef = useRef<Array<{ chainId: string; amount: bigint }>>([])

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

  const addBurn = useCallback((tokenId: string, amount: bigint) => {
    const current = burnsByTokenRef.current.get(tokenId) ?? 0n
    burnsByTokenRef.current.set(tokenId, current + amount)
    setBurnsByToken(new Map(burnsByTokenRef.current))
  }, [])

  const processPendingBurns = useCallback((chainId: string, tokenId: string) => {
    const pending = pendingBurnsRef.current.filter(p => p.chainId === chainId)
    for (const p of pending) {
      addBurn(tokenId, p.amount)
    }
    pendingBurnsRef.current = pendingBurnsRef.current.filter(p => p.chainId !== chainId)
  }, [addBurn])

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

    // Collect player addresses and burn totals from historical events
    playersRef.current = new Map()
    seenEventsRef.current = new Set()
    burnSeenRef.current = new Set()
    burnsByTokenRef.current = new Map()
    chainTokenMapRef.current = new Map()
    pendingBurnsRef.current = []
    const playerSub = contract.subscribeAllEvents({
      pollingInterval: 4000,
      messageCallback: async (event) => {
        if (!mountedRef.current) return
        const eventKey = `${event.txId}:${event.eventIndex}`

        if (event.name === 'ChainStarted') {
          // New chain started — clear stale player entries from previous chains
          playersRef.current = new Map()
          seenEventsRef.current = new Set()
          seenEventsRef.current.add(eventKey)

          // Fetch transaction to identify which token this chain uses
          const fields = event.fields as ChainReactionTypes.ChainStartedEvent['fields']
          const chainId = fields.chainId.toString()
          try {
            const provider = web3.getCurrentNodeProvider()
            const tx = await provider.transactions.getTransactionsDetailsTxid(event.txId)
            let tokenId = ALPH_TOKEN.id
            for (const output of (tx.generatedOutputs ?? [])) {
              if (output.address === contract.address && output.tokens && output.tokens.length > 0) {
                tokenId = output.tokens[0].id
                break
              }
            }
            chainTokenMapRef.current.set(chainId, tokenId)
            processPendingBurns(chainId, tokenId)
          } catch {
            // Fallback: if tx fetch fails, pending burns will be resolved later
          }
        } else if (event.name === 'PlayerJoined') {
          const fields = event.fields as ChainReactionTypes.PlayerJoinedEvent['fields']

          // Accumulate per-token burns across all chains (separate dedup set)
          if (!burnSeenRef.current.has(eventKey) && fields.amountBurned > 0n) {
            burnSeenRef.current.add(eventKey)
            const chainId = fields.chainId.toString()
            const tokenId = chainTokenMapRef.current.get(chainId)
            if (tokenId !== undefined) {
              addBurn(tokenId, fields.amountBurned)
            } else {
              pendingBurnsRef.current.push({ chainId, amount: fields.amountBurned })
            }
          }

          // Player tracking (uses seenEventsRef which resets per chain)
          if (!seenEventsRef.current.has(eventKey)) {
            seenEventsRef.current.add(eventKey)
            const pos = Number(fields.position)
            const key = `${fields.chainId}:${pos}`
            playersRef.current.set(key, { position: pos, address: normalizeAddress(fields.player) })
            setPlayers(Array.from(playersRef.current.values()))
          }
        }
      },
      errorCallback: async () => {},
    }, 0)

    // Fallback poll for non-event changes (e.g. incentive, timer expiry)
    const fallbackInterval = setInterval(refresh, FALLBACK_POLL_MS)

    return () => {
      mountedRef.current = false
      if (subscription) {
        subscription.unsubscribe()
      }
      playerSub.unsubscribe()
      clearInterval(fallbackInterval)
    }
  }, [contract, refresh, addBurn, processPendingBurns])

  return { gameState, isLoading, error, refresh, players, burnsByToken }
}

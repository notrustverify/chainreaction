'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { ChainReactionV1Types } from 'my-contracts'
import { GameContractInstance, normalizeAddress } from '@/services/game.service'

export interface PlayerStats {
  address: string
  wins: number
  totalPayout: bigint
  gamesPlayed: number
  totalSpent: bigint
}

export type LeaderboardSort = 'totalPayout' | 'wins' | 'gamesPlayed'

function getOrCreate(map: Map<string, PlayerStats>, address: string): PlayerStats {
  let s = map.get(address)
  if (!s) {
    s = { address, wins: 0, totalPayout: 0n, gamesPlayed: 0, totalSpent: 0n }
    map.set(address, s)
  }
  return s
}

export function useLeaderboard(contract: GameContractInstance) {
  const statsRef = useRef<Map<string, PlayerStats>>(new Map())
  const [version, setVersion] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    statsRef.current = new Map()
    const seen = new Set<string>()

    const sub = contract.subscribeAllEvents({
      pollingInterval: 4000,
      messageCallback: async (event) => {
        if (cancelled) return

        const eventKey = `${event.txId}:${event.eventIndex}`
        if (seen.has(eventKey)) return
        seen.add(eventKey)

        if (event.name === 'PlayerJoined') {
          const fields = event.fields as ChainReactionV1Types.PlayerJoinedEvent['fields']
          const s = getOrCreate(statsRef.current, normalizeAddress(fields.player))
          s.gamesPlayed += 1
          s.totalSpent += fields.entryFee + fields.amountBurned
        } else if (event.name === 'ChainEnded') {
          const fields = event.fields as ChainReactionV1Types.ChainEndedEvent['fields']
          const s = getOrCreate(statsRef.current, normalizeAddress(fields.winner))
          s.wins += 1
          s.totalPayout += fields.payout
        }

        setVersion(v => v + 1)
        setIsLoading(false)
      },
      errorCallback: async (err, subscription) => {
        if (!cancelled) {
          setError(String(err))
          setIsLoading(false)
        }
      },
    }, 0)

    // If no events exist yet, stop loading after a short delay
    const timeout = setTimeout(() => {
      if (isLoading) setIsLoading(false)
    }, 5000)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      sub.unsubscribe()
    }
  }, [contract])

  const leaderboard = useMemo(() => {
    return Array.from(statsRef.current.values())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return { leaderboard, isLoading, error }
}

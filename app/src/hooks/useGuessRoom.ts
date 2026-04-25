'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { GameRoom, GameRoomTypes } from 'my-contracts'
import {
  RoomInfo,
  fetchRoomState,
  getPlayerPayout,
  hasPlayerJoined,
  getPlayerNumber
} from '@/services/guess.service'

export interface GuessRoomState {
  info: RoomInfo | null
  playerPayout: bigint
  playerNumber: bigint | null
  hasJoined: boolean
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
}

// State-transition event names that warrant an immediate room refresh.
const STATE_TRANSITION_EVENTS = new Set([
  'RoomLocked',    // OPEN → LOCKED  (last player joined)
  'RoomClaimable', // LOCKED → CLAIMABLE (target drawn)
  'RoomExpired',   // → EXPIRED
  'RoomDestroyed', // → DESTROYED
  'Claimed',       // playerCount changes
  'ForceClaimed',
  'Refunded',
  'PotBoosted',    // pot changes
])

export function useGuessRoom(contractAddress: string | null, playerAddress: string | null): GuessRoomState {
  const [info, setInfo] = useState<RoomInfo | null>(null)
  const [playerPayout, setPlayerPayout] = useState(0n)
  const [playerNumber, setPlayerNumber] = useState<bigint | null>(null)
  const [hasJoined, setHasJoined] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  const refresh = useCallback(async () => {
    if (!contractAddress) return
    const instance = GameRoom.at(contractAddress)
    try {
      const roomInfo = await fetchRoomState(instance)
      if (!mountedRef.current) return
      setInfo(roomInfo)
      setError(null)

      if (playerAddress) {
        const [joined, num, payout] = await Promise.all([
          hasPlayerJoined(instance, playerAddress),
          getPlayerNumber(instance, playerAddress),
          getPlayerPayout(instance, playerAddress)
        ])
        if (!mountedRef.current) return
        setHasJoined(joined)
        setPlayerNumber(num)
        setPlayerPayout(payout)
      }
    } catch (err) {
      if (!mountedRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to fetch room')
    } finally {
      if (mountedRef.current) setIsLoading(false)
    }
  }, [contractAddress, playerAddress])

  useEffect(() => {
    if (!contractAddress) {
      setIsLoading(false)
      return
    }

    mountedRef.current = true
    setIsLoading(true)
    refresh()

    const instance = GameRoom.at(contractAddress)
    const seen = new Set<string>()

    // Subscribe to contract events — trigger an immediate refresh on any
    // state-transition event so the UI updates within seconds rather than
    // waiting for the 30s safety poll below.
    const sub = instance.subscribeAllEvents(
      {
        pollingInterval: 4_000,
        messageCallback: async (event) => {
          if (!mountedRef.current) return
          const key = `${event.txId}:${event.eventIndex}`
          if (seen.has(key)) return
          seen.add(key)
          if (STATE_TRANSITION_EVENTS.has(event.name)) {
            await refresh()
          }
        },
        errorCallback: async () => { /* ignore — safety poll covers gaps */ },
      },
      0
    )

    // Safety poll every 30s in case an event is missed.
    const poll = setInterval(refresh, 30_000)

    return () => {
      mountedRef.current = false
      sub.unsubscribe()
      clearInterval(poll)
    }
  }, [contractAddress, refresh])

  return { info, playerPayout, playerNumber, hasJoined, isLoading, error, refresh }
}

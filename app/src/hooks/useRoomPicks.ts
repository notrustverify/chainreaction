'use client'

import { useEffect, useRef, useState } from 'react'
import { GameRoom, GameRoomTypes } from 'my-contracts'
import { normalizeAddress } from '@/services/game.service'

export type PickStatus = 'active' | 'claimed' | 'force-claimed' | 'refunded'

export interface RoomPick {
  player: string
  number: bigint
  status: PickStatus
  // Populated on Claimed / ForceClaimed events.
  payout?: bigint
}

// Computes the on-chain band payout for a given pick, matching GameRoom.ral's
// `bandPayout` helper. Returns 0 when the pick is outside the top 20% band.
// Pass snapshotPot (entryFee × maxPlayers) for display; pass info.pot for
// the live-drain waterfall simulation.
export function bandPayout(
  pick: bigint,
  target: bigint,
  numberRangeMax: bigint,
  pot: bigint,
  maxPlayers: bigint
): bigint {
  if (maxPlayers === 0n) return 0n
  const distance = pick >= target ? pick - target : target - pick
  if (distance === 0n) return (pot * 2n) / maxPlayers
  if (distance <= numberRangeMax / 20n) return (pot * 15n) / 10n / maxPlayers
  if (distance <= numberRangeMax / 5n) return (pot * 12n) / 10n / maxPlayers
  return 0n
}

export function distanceBand(
  distance: bigint,
  numberRangeMax: bigint
): 'exact' | 'top5' | 'top20' | 'miss' {
  if (distance === 0n) return 'exact'
  if (distance <= numberRangeMax / 20n) return 'top5'
  if (distance <= numberRangeMax / 5n) return 'top20'
  return 'miss'
}

export function useRoomPicks(contractAddress: string | null) {
  const picksRef = useRef<Map<string, RoomPick>>(new Map())
  const [version, setVersion] = useState(0)
  const [isLoading, setIsLoading] = useState(!!contractAddress)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!contractAddress) {
      setIsLoading(false)
      picksRef.current = new Map()
      setVersion(v => v + 1)
      return
    }

    let cancelled = false
    picksRef.current = new Map()
    setVersion(v => v + 1)
    setIsLoading(true)
    const seen = new Set<string>()

    const contract = GameRoom.at(contractAddress)
    const sub = contract.subscribeAllEvents({
      pollingInterval: 4000,
      messageCallback: async (event) => {
        if (cancelled) return

        const key = `${event.txId}:${event.eventIndex}`
        if (seen.has(key)) return
        seen.add(key)

        const map = picksRef.current

        if (event.name === 'PlayerJoined') {
          const f = event.fields as GameRoomTypes.PlayerJoinedEvent['fields']
          const addr = normalizeAddress(f.player)
          map.set(addr, { player: addr, number: f.number, status: 'active' })
        } else if (event.name === 'Claimed') {
          const f = event.fields as GameRoomTypes.ClaimedEvent['fields']
          const addr = normalizeAddress(f.player)
          const prev = map.get(addr)
          if (prev) map.set(addr, { ...prev, status: 'claimed', payout: f.payout })
        } else if (event.name === 'ForceClaimed') {
          const f = event.fields as GameRoomTypes.ForceClaimedEvent['fields']
          const addr = normalizeAddress(f.player)
          const prev = map.get(addr)
          if (prev) map.set(addr, { ...prev, status: 'force-claimed', payout: f.payout })
        } else if (event.name === 'Refunded') {
          const f = event.fields as GameRoomTypes.RefundedEvent['fields']
          const addr = normalizeAddress(f.player)
          const prev = map.get(addr)
          if (prev) map.set(addr, { ...prev, status: 'refunded' })
        }

        setVersion(v => v + 1)
        setIsLoading(false)
      },
      errorCallback: async (err) => {
        if (!cancelled) {
          setError(String(err))
          setIsLoading(false)
        }
      }
    }, 0)

    // Stop the spinner after a short delay even if no events have fired yet.
    const timeout = setTimeout(() => {
      if (!cancelled) setIsLoading(false)
    }, 5000)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      sub.unsubscribe()
    }
  }, [contractAddress])

  // Snapshot the map each render. Deliberately re-creating the array rather
  // than memoizing so `version` bumps propagate.
  const picks = Array.from(picksRef.current.values())
  return { picks, isLoading, error, version }
}

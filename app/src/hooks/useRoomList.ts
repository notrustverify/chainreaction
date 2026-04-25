'use client'

import { useState, useEffect, useRef, useMemo } from 'react'
import { addressFromContractId } from '@alephium/web3'
import { GameRoom } from 'my-contracts'
import { GameHubFactoryInstance } from 'my-contracts'
import { RoomInfo, fetchRoomState, ROOM_STATE_DESTROYED } from '@/services/guess.service'

export interface RoomListItem {
  contractId: string
  address: string
  info: RoomInfo | null
  createdAt: number
}

export function useRoomList(factory: GameHubFactoryInstance | null | undefined) {
  const roomsRef = useRef<Map<string, RoomListItem>>(new Map())
  const [version, setVersion] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!factory) {
      setIsLoading(false)
      return
    }

    let cancelled = false
    roomsRef.current = new Map()
    const seen = new Set<string>()

    const sub = factory.subscribeRoomCreatedEvent({
      pollingInterval: 5000,
      messageCallback: async (event) => {
        if (cancelled) return
        const eventKey = `${event.txId}:${event.eventIndex}`
        if (seen.has(eventKey)) return
        seen.add(eventKey)

        const contractId = event.fields.roomContractId
        const address = addressFromContractId(contractId)
        const instance = GameRoom.at(address)

        let info: RoomInfo | null = null
        try {
          info = await fetchRoomState(instance)
        } catch { /* contract may not be ready yet */ }

        if (cancelled) return
        if (info && info.state === ROOM_STATE_DESTROYED) return

        roomsRef.current.set(contractId, {
          contractId,
          address,
          info,
          createdAt: Date.now()
        })
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

    const timeout = setTimeout(() => {
      if (!cancelled) setIsLoading(false)
    }, 6000)

    return () => {
      cancelled = true
      clearTimeout(timeout)
      sub.unsubscribe()
    }
  }, [factory])

  // Periodic refresh of room states — remove destroyed rooms
  useEffect(() => {
    const interval = setInterval(async () => {
      let updated = false
      for (const [key, room] of roomsRef.current) {
        try {
          const instance = GameRoom.at(room.address)
          const info = await fetchRoomState(instance)
          if (info.state === ROOM_STATE_DESTROYED) {
            roomsRef.current.delete(key)
          } else {
            roomsRef.current.set(key, { ...room, info })
          }
          updated = true
        } catch { /* ignore */ }
      }
      if (updated) setVersion(v => v + 1)
    }, 15000)
    return () => clearInterval(interval)
  }, [])

  const rooms = useMemo(() => {
    return Array.from(roomsRef.current.values())
      .filter(r => r.info?.state !== ROOM_STATE_DESTROYED)
      .sort((a, b) => b.createdAt - a.createdAt)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return { rooms, isLoading, error }
}

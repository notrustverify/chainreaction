'use client'

import { useState, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getGuessConfig } from '@/services/guess.service'
import { useRoomList } from '@/hooks/useRoomList'
import { CreateRoom } from '@/components/guess/CreateRoom'
import { RoomCard } from '@/components/guess/RoomCard'
import { RoomDetail } from '@/components/guess/RoomDetail'
import { ROOM_STATE_OPEN, ROOM_STATE_LOCKED, ROOM_STATE_CLAIMABLE, ROOM_STATE_EXPIRED } from '@/services/guess.service'

const guessConfig = getGuessConfig()

function stateOrder(state: bigint) {
  if (state === ROOM_STATE_OPEN) return 0
  if (state === ROOM_STATE_LOCKED) return 1
  if (state === ROOM_STATE_CLAIMABLE) return 2
  if (state === ROOM_STATE_EXPIRED) return 3
  return 4
}

function GuessContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const addressFromUrl = searchParams.get('address')

  const { rooms, isLoading, error } = useRoomList(guessConfig?.factoryInstance)
  const [showCreate, setShowCreate] = useState(false)

  const openConnect = useCallback(() => {
    const btn = document.querySelector('.alephium-connect-button') as HTMLButtonElement
      ?? document.querySelector('nav button') as HTMLButtonElement
    btn?.click()
  }, [])

  const handleSelectRoom = (address: string) => {
    const current = searchParams.get('address')
    if (current === address) {
      router.push('/guess')
    } else {
      router.push(`/guess?address=${address}`)
    }
    setShowCreate(false)
  }

  const handleClose = () => {
    router.push('/guess')
  }

  const sortedRooms = useMemo(() =>
    [...rooms].sort((a, b) => {
      const sa = a.info ? stateOrder(a.info.state) : 99
      const sb = b.info ? stateOrder(b.info.state) : 99
      return sa - sb
    }),
    [rooms]
  )

  if (!guessConfig) {
    return (
      <div className="w-full rounded-2xl border border-card-border bg-card-bg p-6 flex flex-col items-center gap-3 text-center">
        <p className="text-label text-sm">Number Guessing War is not configured on this network.</p>
        <p className="text-muted text-xs">
          Set <code className="bg-stat-card-bg px-1 rounded">NEXT_PUBLIC_GAME_HUB_ADDRESS</code> to the deployed GameHubFactory address.
        </p>
      </div>
    )
  }

  const hasDetail = !!addressFromUrl

  return (
    <div className="w-full flex flex-col gap-8">

      {/* Active room detail — full page width when a room is selected */}
      {hasDetail && (
        <section className="w-full">
          <RoomDetail
            contractAddress={addressFromUrl!}
            onConnectRequest={openConnect}
            onClose={handleClose}
          />
        </section>
      )}

      {/* Rooms section — becomes a browsable gallery beneath an active game */}
      <section className="w-full flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-page-heading">
            {hasDetail ? 'Other rooms' : 'Rooms'}
          </h2>
          {!showCreate && (
            <button
              onClick={() => { setShowCreate(true); handleClose() }}
              className="px-4 py-2 text-sm font-medium rounded-xl bg-primary text-primary-fg hover:bg-primary-hover transition-colors"
            >
              + Create Room
            </button>
          )}
        </div>

        {showCreate && (
          <CreateRoom
            factory={guessConfig.factoryInstance}
            onConnectRequest={openConnect}
            onCreated={() => setShowCreate(false)}
            onClose={() => setShowCreate(false)}
          />
        )}

        {error && (
          <p className="text-sm text-notification-error-text bg-notification-error-bg border border-notification-error-border rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        {isLoading ? (
          <div className={`grid gap-3 ${hasDetail ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {[0, 1, 2].map(i => (
              <div key={i} className="h-24 rounded-2xl border border-card-border bg-card-bg animate-pulse" />
            ))}
          </div>
        ) : sortedRooms.length === 0 ? (
          <div className="w-full rounded-2xl border border-card-border bg-card-bg p-6 text-center">
            <p className="text-label text-sm">No rooms yet.</p>
            <p className="text-muted text-xs mt-1">Create the first one!</p>
          </div>
        ) : (
          <div className={`grid gap-3 ${hasDetail ? 'md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
            {sortedRooms.map(room => room.info && (
              <RoomCard
                key={room.contractId}
                room={room.info}
                isSelected={room.address === addressFromUrl}
                onClick={() => handleSelectRoom(room.address)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

export default function GuessPage() {
  return (
    <main className="flex-1 flex flex-col items-center w-full max-w-5xl px-4 py-8 gap-6">
      <div className="w-full flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-page-heading">Number Guessing War</h1>
        <p className="text-sm text-muted">
          Pick a number and try to land closest to the target — drawn after the
          room fills from a tamper-proof random beacon nobody can predict.
          Exact hit pays 2×, close picks 1.5× / 1.2×.
        </p>
      </div>

      <Suspense fallback={
        <div className="w-full flex flex-col gap-3">
          {[0, 1].map(i => (
            <div key={i} className="h-24 rounded-2xl border border-card-border bg-card-bg animate-pulse" />
          ))}
        </div>
      }>
        <GuessContent />
      </Suspense>
    </main>
  )
}

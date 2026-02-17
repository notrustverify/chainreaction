'use client'

import React, { useCallback, useMemo, useState, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { ChainReaction, ChainReactionV3 } from 'my-contracts'
import { GameBoard } from '@/components/GameBoard'
import { GameContractInstance, fetchRawGameState } from '@/services/game.service'
import '@/services/utils' // ensure node provider is set

function parseTokenIdsFromQuery(searchParams: URLSearchParams): string[] | null {
  const raw = searchParams.get('tokens')
  if (!raw || typeof raw !== 'string') return null
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean)
  return ids.length > 0 ? ids : null
}

function useDetectContractInstance(address: string | null): GameContractInstance | null {
  const [instance, setInstance] = useState<GameContractInstance | null>(null)

  useEffect(() => {
    if (!address) return

    // Detect contract version from raw state field counts
    fetchRawGameState(address).then((state) => {
      setInstance(state.isV3 ? ChainReactionV3.at(address) : ChainReaction.at(address))
    }).catch(() => {
      // Default to V3 if detection fails
      setInstance(ChainReactionV3.at(address))
    })
  }, [address])

  return instance
}

function GameContent() {
  const searchParams = useSearchParams()
  const address = searchParams.get('address')
  const tokenIdsFromQuery = useMemo(() => parseTokenIdsFromQuery(searchParams), [searchParams])
  const router = useRouter()
  const openConnect = useCallback(() => {
    // Click the AlephiumConnectButton rendered in the NavBar
    const btn = document.querySelector('.alephium-connect-button') as HTMLButtonElement
      ?? document.querySelector('nav button') as HTMLButtonElement
    btn?.click()
  }, [])
  const browseGames = useCallback(() => {
    router.push('/#games')
  }, [router])

  if (!address) {
    return (
        <main className="flex-1 flex flex-col items-center justify-center w-full">
          <p className="text-muted">No game address specified.</p>
        </main>
    )
  }

  const contractInstance = useDetectContractInstance(address)

  if (!contractInstance) {
    return (
      <main className="flex-1 flex flex-col items-center justify-center w-full">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </main>
    )
  }

  return (
      <main className="flex-1 flex flex-col items-center justify-center w-full">
        <GameBoard
          contractInstance={contractInstance}
          onConnectRequest={openConnect}
          onBrowseGames={browseGames}
          tokenIdsFromQuery={tokenIdsFromQuery}
        />
      </main>
  )
}

export default function GamePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex flex-col items-center justify-center bg-bg">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <GameContent />
    </Suspense>
  )
}

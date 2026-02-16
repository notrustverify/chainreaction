'use client'

import React, { useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChainReactionV3, ChainReactionV1 } from 'my-contracts'
import { GameBoard } from '@/components/GameBoard'
import { gameConfig } from '@/services/utils' // ensure node provider is set

function parseTokenIdsFromQuery(searchParams: URLSearchParams): string[] | null {
  const raw = searchParams.get('tokens')
  if (!raw || typeof raw !== 'string') return null
  const ids = raw.split(',').map(s => s.trim()).filter(Boolean)
  return ids.length > 0 ? ids : null
}

function GameContent() {
  const searchParams = useSearchParams()
  const address = searchParams.get('address')
  const tokenIdsFromQuery = useMemo(() => parseTokenIdsFromQuery(searchParams), [searchParams])
  const openConnect = useCallback(() => {
    // Click the AlephiumConnectButton rendered in the NavBar
    const btn = document.querySelector('.alephium-connect-button') as HTMLButtonElement
      ?? document.querySelector('nav button') as HTMLButtonElement
    btn?.click()
  }, [])

  if (!address) {
    return (
        <main className="flex-1 flex flex-col items-center justify-center w-full">
          <p className="text-muted">No game address specified.</p>
        </main>
    )
  }

  const isV1 = gameConfig.v1Address === address
  const contractInstance = useMemo(
    () => isV1 ? ChainReactionV1.at(address) : ChainReactionV3.at(address),
    [address, isV1]
  )

  return (
      <main className="flex-1 flex flex-col items-center justify-center w-full">
        <GameBoard
          contractInstance={contractInstance}
          onConnectRequest={openConnect}
          tokenIdsFromQuery={tokenIdsFromQuery}
          isV1={isV1}
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

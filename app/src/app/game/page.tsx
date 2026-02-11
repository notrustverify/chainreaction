'use client'

import React, { useRef, useCallback, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChainReaction, ChainReactionV1 } from 'my-contracts'
import { GameBoard } from '@/components/GameBoard'
import { NavBar } from '@/components/NavBar'
import { gameConfig } from '@/services/utils' // ensure node provider is set

function GameContent() {
  const searchParams = useSearchParams()
  const address = searchParams.get('address')
  const connectRef = useRef<HTMLDivElement>(null)

  const openConnect = useCallback(() => {
    const btn = connectRef.current?.querySelector('button')
    btn?.click()
  }, [])

  if (!address) {
    return (
      <div className="min-h-screen flex flex-col items-center bg-bg">
        <NavBar ref={connectRef} />
        <main className="flex-1 flex flex-col items-center justify-center w-full">
          <p className="text-muted">No game address specified.</p>
        </main>
      </div>
    )
  }

  const isV1 = gameConfig.v1Address === address
  const contractInstance = useMemo(
    () => isV1 ? ChainReactionV1.at(address) : ChainReaction.at(address),
    [address, isV1]
  )

  return (
      <main className="flex-1 flex flex-col items-center justify-center w-full">
        <GameBoard contractInstance={contractInstance} onConnectRequest={openConnect} />
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

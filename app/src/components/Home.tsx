'use client'

import React, { useRef, useCallback, useMemo } from 'react'
import { GameBoard } from './GameBoard'
import { GameList } from './GameList'
import { CreateGame } from './CreateGame'
import { useGameList } from '@/hooks/useGameList'
import { gameConfig } from '@/services/utils'

export default function Home() {
  const gamesRef = useRef<HTMLDivElement>(null)
  const { games, isLoading, error } = useGameList(gameConfig.factoryInstance, gameConfig.oldFactoryInstance)

  const openConnect = useCallback(() => {
    // Click the AlephiumConnectButton rendered in the NavBar
    const btn = document.querySelector('.alephium-connect-button') as HTMLButtonElement
      ?? document.querySelector('nav button') as HTMLButtonElement
    btn?.click()
  }, [])

  const featuredInstance = useMemo(() => gameConfig.getFeaturedInstance(), [])

  const scrollToGames = () => {
    gamesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <>
      <main className="flex-1 flex flex-col items-center w-full max-w-6xl px-4 py-8 gap-5">


      {featuredInstance && (
          <GameBoard contractInstance={featuredInstance} onConnectRequest={openConnect} onBrowseGames={scrollToGames} />
        )}

        <h1 className="text-2xl font-bold text-page-heading">All Games</h1>

        <div ref={gamesRef} className="w-full max-w-6xl px-4 py-8 flex flex-col items-center gap-5">
          <React.Suspense fallback={
            <div className="w-full flex flex-col items-center gap-5">
              <div className="w-full h-64 rounded-2xl border border-card-border bg-card-bg animate-pulse" />
              <div className="w-full flex justify-center py-4">
                <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            </div>
          }>
            <CreateGame
              factory={gameConfig.factoryInstance}
              onConnectRequest={openConnect}
            />

            {error && (
             <p className="w-full text-center text-sm text-notification-error-text bg-notification-error-bg border border-notification-error-border rounded-xl px-4 py-3">
                {error}
              </p>
            )}

            <GameList games={games} isLoading={isLoading} />
          </React.Suspense>
        </div>
      </main>
    </> 
  )
}

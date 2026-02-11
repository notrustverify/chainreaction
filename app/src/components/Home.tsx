'use client'

import React, { useRef, useCallback, useMemo } from 'react'
import { ChainReactionV1 } from 'my-contracts'
import { NavBar } from './NavBar'
import { GameBoard } from './GameBoard'
import { GameList } from './GameList'
import { CreateGame } from './CreateGame'
import { useGameList } from '@/hooks/useGameList'
import { gameConfig } from '@/services/utils'

export default function Home() {
  const connectRef = useRef<HTMLDivElement>(null)
  const gamesRef = useRef<HTMLDivElement>(null)
  const { games, isLoading, error } = useGameList(gameConfig.factoryInstance)

  const openConnect = useCallback(() => {
    const btn = connectRef.current?.querySelector('button')
    btn?.click()
  }, [])

  const v1Instance = useMemo(
    () => gameConfig.v1Address ? ChainReactionV1.at(gameConfig.v1Address) : null,
    []
  )

  const scrollToGames = () => {
    gamesRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  return (
    <> 
      <main className="flex-1 flex flex-col items-center w-full max-w-6xl px-4 py-8 gap-5">
        <h1 className="text-2xl font-bold text-page-heading">All Games</h1>

        {v1Instance && (
          <GameBoard contractInstance={v1Instance} onConnectRequest={openConnect} onBrowseGames={scrollToGames} />
        )}

        <div ref={gamesRef} className="w-full max-w-6xl px-4 py-8 flex flex-col items-center gap-5">

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
          
        </div>
      </main>
    </> 
  )
}

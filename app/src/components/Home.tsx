'use client'

import React, { useRef, useCallback } from 'react'
import { NavBar } from './NavBar'
import { GameList } from './GameList'
import { CreateGame } from './CreateGame'
import { LegacyGame } from './LegacyGame'
import { useGameList } from '@/hooks/useGameList'
import { gameConfig } from '@/services/utils'

export default function Home() {

  const { games, isLoading, error } = useGameList(gameConfig.factoryInstance)

  const openConnect = useCallback(() => {
    const btn = connectRef.current?.querySelector('button')
    btn?.click()
  }, [])

  return (
    <> 
      <main className="flex-1 flex flex-col items-center w-full max-w-6xl px-4 py-8 gap-5">
        <h1 className="text-2xl font-bold text-page-heading">Games</h1>

        {gameConfig.v1Address && (
          <LegacyGame address={gameConfig.v1Address} />
        )}

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

      </main>
    </> 
  )
}

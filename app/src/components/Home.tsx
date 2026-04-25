'use client'

import React, { useRef, useCallback, useMemo } from 'react'
import Link from 'next/link'
import { GameBoard } from './GameBoard'
import { GameList } from './GameList'
import { CreateGame } from './CreateGame'
import { NewGameAnnouncementModal } from './NewGameAnnouncementModal'
import { useGameList } from '@/hooks/useGameList'
import { gameConfig } from '@/services/utils'

export default function Home() {
  const gamesRef = useRef<HTMLDivElement>(null)
  const { games, isLoading, error } = useGameList(gameConfig.factoryInstance, gameConfig.oldFactoryInstance)

  const openConnect = useCallback(() => {
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
      <NewGameAnnouncementModal />
      <main className="flex-1 flex flex-col items-center w-full max-w-6xl px-4 py-8 gap-8">

        {/* Game hub — choose your game */}
        <section className="w-full flex flex-col items-center gap-4">
          <h1 className="text-2xl font-bold text-page-heading">Choose your game</h1>
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">

            {/* Chain Reaction */}
            <div className="flex flex-col gap-3 p-6 rounded-2xl border border-card-border bg-card-bg">
              <h2 className="text-xl font-bold text-page-heading">Chain Reaction</h2>
              <p className="text-sm text-muted flex-1">
                Last-player-standing auction. Every new entry raises the price and resets the clock.
                When time runs out, the last player wins the entire pot.
              </p>
              <div className="flex flex-col gap-1.5 text-xs text-label">
                <span>↑ Entry price grows each round</span>
                <span>⏱ Timer shrinks with every play</span>
                <span>🏆 Last player takes the pot</span>
              </div>
              <button
                onClick={scrollToGames}
                className="mt-2 w-full text-center text-sm font-semibold px-4 py-2.5 rounded-xl bg-primary text-primary-text hover:opacity-90 transition-opacity"
              >
                Play Chain Reaction
              </button>
            </div>

            {/* Number Guessing War */}
            <div className="flex flex-col gap-3 p-6 rounded-2xl border border-card-border bg-card-bg">
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold text-page-heading">Number Guessing War</h2>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-status-warning-bg text-status-claimable">
                  New
                </span>
              </div>
              <p className="text-sm text-muted flex-1">
                Pick a number and try to land closest to a drand-powered secret target.
                Payouts are fixed the moment the target is drawn — no timing advantage.
              </p>
              <div className="flex flex-col gap-1.5 text-xs text-label">
                <span>🎯 Exact hit → 2× your entry</span>
                <span>🔒 Target drawn by drand beacon (tamper-proof)</span>
                <span>⚖️ Same payout for everyone in a band</span>
              </div>
              <Link
                href="/guess"
                className="mt-2 w-full text-center text-sm font-semibold px-4 py-2.5 rounded-xl bg-primary text-primary-text hover:opacity-90 transition-opacity"
              >
                Play Number Guessing War
              </Link>
            </div>

          </div>
        </section>

        {/* Featured Chain Reaction game */}
        {featuredInstance && (
          <div className="w-full">
            <GameBoard contractInstance={featuredInstance} onConnectRequest={openConnect} onBrowseGames={scrollToGames} />
          </div>
        )}

        <h2 className="text-xl font-bold text-page-heading self-start">All Chain Reaction Games</h2>

        <div id="games" ref={gamesRef} className="w-full flex flex-col items-center gap-5">
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

            <GameList games={games} isLoading={isLoading} excludeAddress={gameConfig.featuredAddress} />
          </React.Suspense>
        </div>
      </main>
    </>
  )
}

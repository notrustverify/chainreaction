'use client'

import React from 'react'
import { NavBar } from '@/components/NavBar'
import { Leaderboard } from '@/components/Leaderboard'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useWallet } from '@alephium/web3-react'
import { gameConfig } from '@/services/utils'

export default function LeaderboardPage() {
  const { leaderboard, isLoading, error } = useLeaderboard(gameConfig.contractInstance)
  const { account } = useWallet()

  return (
    <div className="min-h-screen flex flex-col items-center bg-white">
      <NavBar />
      <main className="flex-1 flex flex-col items-center w-full max-w-lg px-4 py-8 gap-5">
        <h1 className="text-2xl font-bold text-gray-900">Leaderboard</h1>

        {error && (
          <p className="w-full text-center text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <Leaderboard
          data={leaderboard}
          isLoading={isLoading}
          currentUserAddress={account?.address}
        />

        <p className="text-xs text-gray-400 mt-4">
          Built by{' '}
          <a href="https://notrustverify.ch" target="_blank" rel="noopener noreferrer" className="text-emerald-500 hover:text-emerald-600 underline">
            No Trust Verify
          </a>
        </p>
      </main>
    </div>
  )
}

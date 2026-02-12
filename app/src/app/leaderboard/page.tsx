'use client'

import React, { useMemo } from 'react'
import { Leaderboard } from '@/components/Leaderboard'
import { useLeaderboard } from '@/hooks/useLeaderboard'
import { useWallet } from '@alephium/web3-react'
import { gameConfig } from '@/services/utils'

export default function LeaderboardPage() {
  const v1Instance = useMemo(() => gameConfig.getV1Instance(), [])
  const { leaderboard, isLoading, error } = useLeaderboard(v1Instance)
  const { account } = useWallet()

  return (
      <main className="flex-1 flex flex-col items-center w-full max-w-lg px-4 py-8 gap-5">
        <h1 className="text-2xl font-bold text-page-heading">Leaderboard</h1>

        {error && (
          <p className="w-full text-center text-sm text-notification-error-text bg-notification-error-bg border border-notification-error-border rounded-xl px-4 py-3">
            {error}
          </p>
        )}

        <Leaderboard
          data={leaderboard}
          isLoading={isLoading}
          currentUserAddress={account?.address}
        />
       
      </main>
    
  )
}

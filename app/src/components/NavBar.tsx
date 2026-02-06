'use client'

import React, { forwardRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlephiumConnectButton } from '@alephium/web3-react'

export const NavBar = forwardRef<HTMLDivElement>((_, ref) => {
  const pathname = usePathname()

  return (
    <nav className="w-full flex items-center justify-between px-4 py-3 border-b border-gray-100">
      <div className="flex items-center gap-6">
        <Link href="/" className="text-lg font-bold text-gray-900">
          Chain Reaction
        </Link>
        <div className="flex gap-4">
          <Link
            href="/"
            className={`text-sm font-medium transition-colors ${
              pathname === '/' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Game
          </Link>
          <Link
            href="/leaderboard"
            className={`text-sm font-medium transition-colors ${
              pathname === '/leaderboard' ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
            }`}
          >
            Leaderboard
          </Link>
        </div>
      </div>
      <div ref={ref}>
        <AlephiumConnectButton />
      </div>
    </nav>
  )
})

NavBar.displayName = 'NavBar'

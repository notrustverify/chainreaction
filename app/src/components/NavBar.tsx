'use client'

import React, { forwardRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlephiumConnectButton } from '@alephium/web3-react'

export const NavBar = forwardRef<HTMLDivElement>((_, ref) => {
  const pathname = usePathname()

  return (
    <nav className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-nav-border">
      <div className="flex items-center gap-3 sm:gap-6">
        <Link href="/" className="text-lg font-bold text-nav-brand whitespace-nowrap hidden sm:block">
          Chain Reaction
        </Link>
        <div className="flex gap-2 sm:gap-4">
          <Link
            href="/"
            className={`text-sm font-medium whitespace-nowrap transition-colors ${
              pathname === '/' ? 'text-nav-link-active' : 'text-nav-link hover:text-nav-link-hover'
            }`}
          >
            Games
          </Link>
          <Link
            href="/leaderboard"
            className={`text-sm font-medium whitespace-nowrap transition-colors ${
              pathname === '/leaderboard' ? 'text-nav-link-active' : 'text-nav-link hover:text-nav-link-hover'
            }`}
          >
            Leaderboard
          </Link>
          <Link
            href="/how-to-play"
            className={`text-sm font-medium whitespace-nowrap transition-colors ${
              pathname === '/how-to-play' ? 'text-nav-link-active' : 'text-nav-link hover:text-nav-link-hover'
            }`}
          >
            Rules
          </Link>
        </div>
      </div>
      <div ref={ref} className="ml-auto">
        <AlephiumConnectButton />
      </div>
    </nav>
  )
})

NavBar.displayName = 'NavBar'

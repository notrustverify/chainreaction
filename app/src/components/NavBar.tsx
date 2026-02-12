'use client'

import React, { forwardRef } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlephiumConnectButton } from '@alephium/web3-react'
import { useThemeForcedParam, useTokensParam, appendPreservedParamsToHref } from '@/theme/useThemeForcedParam'
import { useEmbeddedWallet } from '@/embed/EmbeddedWalletContext'
import { isEmbedded } from '@/embed/walletBridge'
import { shortenAddress } from '@/services/game.service'

/**
 * Fallback when NavBar suspends (useSearchParams). Same layout, plain links.
 * Used so 404 and static pages can build without a Suspense bailout.
 */
function NavBarFallback() {
  return (
    <nav className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-nav-border">
      <div className="flex items-center gap-3 sm:gap-6">
        <Link href="/" className="text-lg font-bold text-nav-brand whitespace-nowrap hidden sm:block">
          Chain Reaction
        </Link>
        <div className="flex gap-2 sm:gap-4">
          <Link href="/" className="text-sm font-medium whitespace-nowrap text-nav-link hover:text-nav-link-hover">
            Games
          </Link>
          <Link href="/leaderboard" className="text-sm font-medium whitespace-nowrap text-nav-link hover:text-nav-link-hover">
            Leaderboard
          </Link>
          <Link href="/how-to-play" className="text-sm font-medium whitespace-nowrap text-nav-link hover:text-nav-link-hover">
            Rules
          </Link>
        </div>
      </div>
      <div className="ml-auto">
        {isEmbedded() ? null : <AlephiumConnectButton />}
      </div>
    </nav>
  )
}

const NavBarInner = forwardRef<HTMLDivElement>(function NavBarInner(_, ref) {
  const pathname = usePathname()
  const themeParam = useThemeForcedParam()
  const tokensParam = useTokensParam()
  const preserved = { theme: themeParam, tokens: tokensParam }
  const { address: embeddedAddress, isEmbeddedWallet, isEmbedBridge } = useEmbeddedWallet()

  const showParentAddress = isEmbeddedWallet && embeddedAddress
  const hideConnectButton = isEmbedBridge

  return (
    <nav className="w-full flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-nav-border">
      <div className="flex items-center gap-3 sm:gap-6">
        <Link href={appendPreservedParamsToHref('/', preserved)} className="text-lg font-bold text-nav-brand whitespace-nowrap hidden sm:block">
          Chain Reaction
        </Link>
        <div className="flex gap-2 sm:gap-4">
          <Link
            href={appendPreservedParamsToHref('/', preserved)}
            className={`text-sm font-medium whitespace-nowrap transition-colors ${
              pathname === '/' ? 'text-nav-link-active' : 'text-nav-link hover:text-nav-link-hover'
            }`}
          >
            Games
          </Link>
          <Link
            href={appendPreservedParamsToHref('/leaderboard', preserved)}
            className={`text-sm font-medium whitespace-nowrap transition-colors ${
              pathname === '/leaderboard' ? 'text-nav-link-active' : 'text-nav-link hover:text-nav-link-hover'
            }`}
          >
            Leaderboard
          </Link>
          <Link
            href={appendPreservedParamsToHref('/how-to-play', preserved)}
            className={`text-sm font-medium whitespace-nowrap transition-colors ${
              pathname === '/how-to-play' ? 'text-nav-link-active' : 'text-nav-link hover:text-nav-link-hover'
            }`}
          >
            Rules
          </Link>
        </div>
      </div>
      <div ref={ref} className="ml-auto flex items-center">
        {showParentAddress ? (
          <span className="text-sm font-medium text-nav-link" title={embeddedAddress}>
            {shortenAddress(embeddedAddress)}
          </span>
        ) : hideConnectButton ? null : (
          <AlephiumConnectButton />
        )}
      </div>
    </nav>
  )
})

export const NavBar = forwardRef<HTMLDivElement>((_, ref) => (
  <React.Suspense fallback={<NavBarFallback />}>
    <NavBarInner ref={ref} />
  </React.Suspense>
))

NavBar.displayName = 'NavBar'

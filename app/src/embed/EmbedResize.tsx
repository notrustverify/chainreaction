'use client'

import { usePathname } from 'next/navigation'
import { useEmbedResize } from '@/hooks/useEmbedResize'

/**
 * When the app is embedded in an iframe, reports width/height to the parent so it can resize the iframe.
 * Rendered once in the root layout so all pages get resize behavior without calling the hook per page.
 * Reports on route change so the iframe shrinks when navigating to shorter pages (e.g. leaderboard, rules, game).
 */
export function EmbedResize() {
  const pathname = usePathname()
  useEmbedResize(pathname)
  return null
}

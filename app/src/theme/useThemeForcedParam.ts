'use client'

import { useEffect, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { isAllowedTheme } from '@/theme/registry'

/** Query param names we preserve when building internal links (theme + tokens). */
export const PRESERVED_PARAM_KEYS = ['theme', 'tokens'] as const

/**
 * When theme is forced (set from URL ?theme=...), returns the theme param string
 * so internal links can preserve it. Returns null when theme is not forced.
 * Re-runs when pathname changes so param stays in sync after navigation.
 */
export function useThemeForcedParam(): string | null {
  const pathname = usePathname()
  const [param, setParam] = useState<string | null>(null)

  useEffect(() => {
    const forced = document.documentElement.dataset.themeForced === '1'
    const theme = document.documentElement.dataset.theme
    if (forced && theme && isAllowedTheme(theme)) {
      setParam(`theme=${theme}`)
    } else {
      setParam(null)
    }
  }, [pathname])

  return param
}

/**
 * Returns the current "tokens" query param string to preserve on links (e.g. "tokens=id1,id2"),
 * or null if not present.
 */
export function useTokensParam(): string | null {
  const searchParams = useSearchParams()
  const raw = searchParams.get('tokens')
  if (!raw || typeof raw !== 'string') return null
  const trimmed = raw.trim()
  return trimmed.length > 0 ? `tokens=${encodeURIComponent(trimmed)}` : null
}

/**
 * Params to append to internal links (theme and/or tokens).
 */
export interface PreservedParams {
  theme: string | null
  tokens: string | null
}

/**
 * Appends preserved query params (theme, tokens) to an href so they propagate across pages.
 * Use for all internal links.
 */
export function appendPreservedParamsToHref(
  href: string,
  preserved: PreservedParams
): string {
  const parts: string[] = []
  if (preserved.theme) parts.push(preserved.theme)
  if (preserved.tokens) parts.push(preserved.tokens)
  if (parts.length === 0) return href
  const query = parts.join('&')
  return href.includes('?') ? `${href}&${query}` : `${href}?${query}`
}

/**
 * Appends the theme query param to an href when theme is forced.
 * Prefer appendPreservedParamsToHref so theme and tokens both propagate.
 */
export function appendThemeToHref(href: string, themeParam: string | null): string {
  return appendPreservedParamsToHref(href, { theme: themeParam, tokens: null })
}

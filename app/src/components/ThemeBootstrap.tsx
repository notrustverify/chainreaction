'use client'

import { useSearchParams } from 'next/navigation'
import { useEffect } from 'react'
import { isAllowedTheme, STORAGE_KEY } from '@/theme/registry'

/**
 * Runs after hydration. Syncs data-theme and data-theme-forced from URL or localStorage.
 * The inline script in layout prevents FOUC; this handles client navigation and forced state.
 */
export function ThemeBootstrap() {
  const searchParams = useSearchParams()

  useEffect(() => {
    const themeParam = searchParams.get('theme')

    if (isAllowedTheme(themeParam)) {
      document.documentElement.dataset.theme = themeParam
      document.documentElement.dataset.themeForced = '1'
      return
    }

    const stored = localStorage.getItem(STORAGE_KEY)
    if (isAllowedTheme(stored)) {
      document.documentElement.dataset.theme = stored
      document.documentElement.dataset.themeForced = '0'
      return
    }

    const dark = window.matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
    document.documentElement.dataset.themeForced = '0'
  }, [searchParams])

  return null
}

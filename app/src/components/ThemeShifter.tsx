'use client'

import React, { useEffect, useState } from 'react'
import { RiMoonLine, RiSunLine } from 'react-icons/ri'
import { isAllowedTheme, STORAGE_KEY } from '@/theme/registry'
import type { ThemeName } from '@/theme/registry'

function getThemeForced(): boolean {
  if (typeof document === 'undefined') return false
  return document.documentElement.dataset.themeForced === '1'
}

function getCurrentTheme(): ThemeName {
  if (typeof document === 'undefined') return 'light'
  const t = document.documentElement.dataset.theme
  return isAllowedTheme(t) ? t : 'light'
}

export function ThemeShifter() {
  const [theme, setTheme] = useState<ThemeName>('light')
  const [forced, setForced] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setForced(getThemeForced())
    setTheme(getCurrentTheme())
  }, [])

  const applyTheme = (next: ThemeName) => {
    const root = document.documentElement
    root.setAttribute('data-theme', next)
    root.setAttribute('data-theme-forced', '0')
    localStorage.setItem(STORAGE_KEY, next)
    setTheme(next)
  }

  if (!mounted || forced) return null

  const isLight = theme === 'light'
  const isDark = theme === 'dark'

  return (
    <div
      role="group"
      aria-label="Theme"
      className="theme-shifter flex rounded-lg border border-border-strong overflow-hidden bg-surface"
    >
      <button
        type="button"
        onClick={() => isLight || applyTheme('light')}
        aria-label="Light mode"
        aria-pressed={isLight}
        className={`p-2 transition-colors rounded-md ${
          isLight ? ' text-primary-fg' : 'text-muted cursor-pointer hover:text-muted-hover hover:bg-surface'
        }`}
      >
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${isLight ? 'bg-active' : ''}`}>
          <RiSunLine className="w-5 h-5" />
        </span>
      </button>
      <button
        type="button"
        onClick={() => isDark || applyTheme('dark')}
        aria-label="Dark mode"
        aria-pressed={isDark}
        className={`p-2 transition-colors rounded-md ${
          isDark ? 'text-primary-fg' : 'text-muted cursor-pointer  hover:text-muted-hover hover:bg-surface'
        }`}
      >
        <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full ${isDark ? 'bg-active' : ''}`}>
          <RiMoonLine className="w-5 h-5" />
        </span>
      </button>
    </div>
  )
}

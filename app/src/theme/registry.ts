/**
 * Single source of truth for allowed themes.
 * Used by server and client (ThemeBootstrap, ThemeShifter, inline FOUC script).
 */
export const ALLOWED_THEMES = ['light', 'dark', 'elexium'] as const
export type ThemeName = (typeof ALLOWED_THEMES)[number]

export function isAllowedTheme(
  x: string | null | undefined
): x is ThemeName {
  if (x == null) return false
  return (ALLOWED_THEMES as readonly string[]).includes(x)
}

export const STORAGE_KEY = 'chainreaction-theme'

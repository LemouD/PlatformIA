export const THEMES = ['velvet', 'nuit'] as const
export type Theme = (typeof THEMES)[number]

export const DEFAULT_THEME: Theme = 'velvet'
export const THEME_COOKIE = 'theme'

export const THEME_LABELS: Record<Theme, string> = {
  velvet: 'Velours bordeaux',
  nuit: 'Velours bleu nuit',
}

/** Swatch shown next to each option: the velvet of that theme (agents design spec 16.3). */
export const THEME_SWATCHES: Record<Theme, string> = {
  velvet: '#3a0c1e',
  nuit: '#142158',
}

/** Reads the theme cookie; anything unexpected falls back to the default velvet. */
export function parseTheme(value: string | undefined): Theme {
  return THEMES.find((theme) => theme === value) ?? DEFAULT_THEME
}

/** Cookie kept on this device for a year; Secure as soon as the page is served over HTTPS. */
export function themeCookie(theme: Theme, secure: boolean): string {
  return `${THEME_COOKIE}=${theme}; Path=/; Max-Age=31536000; SameSite=Strict${secure ? '; Secure' : ''}`
}

import { describe, expect, it } from 'vitest'
import { parseTheme, themeCookie } from './theme'

describe('parseTheme', () => {
  it('accepts the two known themes', () => {
    expect(parseTheme('velvet')).toBe('velvet')
    expect(parseTheme('nuit')).toBe('nuit')
  })

  it('falls back to velvet for a missing or forged value', () => {
    expect(parseTheme(undefined)).toBe('velvet')
    expect(parseTheme('"><script>')).toBe('velvet')
    expect(parseTheme('NUIT')).toBe('velvet')
  })
})

describe('themeCookie', () => {
  it('is strict, site-wide and lasts a year', () => {
    expect(themeCookie('nuit', false)).toBe('theme=nuit; Path=/; Max-Age=31536000; SameSite=Strict')
  })

  it('adds Secure over HTTPS', () => {
    expect(themeCookie('velvet', true)).toContain('; Secure')
  })
})

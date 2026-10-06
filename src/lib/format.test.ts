import { describe, expect, it } from 'vitest'
import {
  formatClockTime,
  formatCompactNumber,
  formatEuro,
  formatHeadingDate,
  formatPercent,
} from './format'

describe('formatCompactNumber', () => {
  it('keeps small numbers as they are', () => {
    expect(formatCompactNumber(0)).toBe('0')
    expect(formatCompactNumber(999)).toBe('999')
  })

  it('abbreviates thousands with one decimal', () => {
    expect(formatCompactNumber(12_400)).toBe('12.4K')
  })

  it('drops a trailing zero decimal', () => {
    expect(formatCompactNumber(3_000)).toBe('3K')
  })

  it('abbreviates millions', () => {
    expect(formatCompactNumber(2_500_000)).toBe('2.5M')
  })
})

describe('formatPercent', () => {
  it('shows one decimal', () => {
    expect(formatPercent(99.9)).toBe('99.9%')
    expect(formatPercent(100)).toBe('100.0%')
  })
})

describe('formatEuro', () => {
  it('shows two decimals with the euro sign first', () => {
    expect(formatEuro(2.41)).toBe('€2.41')
    expect(formatEuro(3)).toBe('€3.00')
  })
})

describe('formatClockTime', () => {
  it('pads hours, minutes and seconds', () => {
    expect(formatClockTime(new Date(2026, 9, 1, 6, 2, 9).getTime())).toBe('06:02:09')
  })
})

describe('formatHeadingDate', () => {
  it('matches the mockup eyebrow format', () => {
    expect(formatHeadingDate(new Date(2026, 9, 1, 16, 42))).toBe('THURSDAY · 01 OCTOBER · 16:42')
  })
})

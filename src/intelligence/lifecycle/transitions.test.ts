import { describe, expect, it } from 'vitest'
import { allowsMode, canTransition } from './transitions'

describe('canTransition', () => {
  it.each([
    ['draft', 'test'],
    ['test', 'active'],
    ['test', 'draft'],
    ['active', 'disabled'],
    ['disabled', 'test'],
    ['disabled', 'draft'],
  ] as const)('allows %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(true)
  })
  it.each([
    ['draft', 'active'],
    ['active', 'test'],
    ['active', 'draft'],
    ['disabled', 'active'],
    ['test', 'test'],
  ] as const)('refuses %s -> %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false)
  })
})

describe('allowsMode', () => {
  it('allows only test runs in test', () => {
    expect(allowsMode('test', 'test')).toBe(true)
    expect(allowsMode('test', 'live')).toBe(false)
  })
  it('allows both modes when active', () => {
    expect(allowsMode('active', 'test')).toBe(true)
    expect(allowsMode('active', 'live')).toBe(true)
  })
  it('allows nothing in draft or disabled', () => {
    expect(allowsMode('draft', 'test')).toBe(false)
    expect(allowsMode('disabled', 'live')).toBe(false)
  })
})

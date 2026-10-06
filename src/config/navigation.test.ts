import { describe, expect, it } from 'vitest'
import { NAV_ITEMS, isNavItemActive } from './navigation'

describe('NAV_ITEMS', () => {
  it('lists the seven sections in mockup order', () => {
    expect(NAV_ITEMS.map((item) => item.label)).toEqual([
      'Command Center',
      'Agents',
      'Tasks',
      'Memory',
      'Knowledge',
      'Tools',
      'Logs',
    ])
  })

  it('uses unique hrefs', () => {
    const hrefs = NAV_ITEMS.map((item) => item.href)
    expect(new Set(hrefs).size).toBe(hrefs.length)
  })
})

describe('isNavItemActive', () => {
  it('matches the root only on the exact path', () => {
    expect(isNavItemActive('/', '/')).toBe(true)
    expect(isNavItemActive('/agents', '/')).toBe(false)
  })

  it('matches a section and its nested routes', () => {
    expect(isNavItemActive('/agents', '/agents')).toBe(true)
    expect(isNavItemActive('/agents/research', '/agents')).toBe(true)
  })

  it('does not match a section that only shares a prefix', () => {
    expect(isNavItemActive('/tasks-archive', '/tasks')).toBe(false)
  })
})

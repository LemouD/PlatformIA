import { describe, expect, it } from 'vitest'
import { MAX_COMMAND_LENGTH, normalizeCommand } from './command'

describe('normalizeCommand', () => {
  it('trims and collapses whitespace', () => {
    expect(normalizeCommand('  turn   off\tthe lights \n')).toBe('turn off the lights')
  })

  it('returns null for empty or blank input', () => {
    expect(normalizeCommand('')).toBeNull()
    expect(normalizeCommand('   \n ')).toBeNull()
  })

  it('caps the length', () => {
    const result = normalizeCommand('a'.repeat(MAX_COMMAND_LENGTH + 50))
    expect(result).toHaveLength(MAX_COMMAND_LENGTH)
  })
})

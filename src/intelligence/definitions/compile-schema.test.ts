import { describe, expect, it } from 'vitest'
import { menuDraft } from '../testing/fixtures'
import { compileOutputSchema } from './compile-schema'

function nested(depth: number): Record<string, unknown> {
  let node: Record<string, unknown> = { type: 'string' }
  for (let i = 0; i < depth; i++) {
    node = { type: 'object', additionalProperties: false, required: ['x'], properties: { x: node } }
  }
  return node
}

describe('compileOutputSchema', () => {
  it('validates data against the compiled schema', () => {
    const validate = compileOutputSchema(menuDraft().outputSchema)
    expect(validate?.({ recipes: [], shoppingList: [] })).toBe(true)
    expect(validate?.({ recipes: 'non' })).toBe(false)
  })
  it.each([
    ['an unknown keyword', { type: 'object', additionalProperties: false, required: [], properties: {}, format: 'x' }],
    ['a remote $ref', { type: 'object', additionalProperties: false, required: ['a'], properties: { a: { $ref: 'https://evil.example/s.json' } } }],
    ['a $data reference', { type: 'object', additionalProperties: false, required: ['a'], properties: { a: { const: { $data: '1/b' } } } }],
    ['an excessive depth', nested(12)],
  ])('refuses %s before compilation', (_label, schema) => {
    expect(compileOutputSchema(schema)).toBeNull()
  })
})

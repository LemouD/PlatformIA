import { describe, expect, it } from 'vitest'
import { checkOutputSchema } from './output-schema'
import { menuDraft } from '../testing/fixtures'

describe('checkOutputSchema', () => {
  it('accepts the menu schema', () => {
    expect(checkOutputSchema(menuDraft().outputSchema)).toEqual([])
  })
  it('requires an object at the root', () => {
    expect(checkOutputSchema({ type: 'string' })).toEqual(['outputSchema: la racine doit être un objet'])
  })
  it('requires additionalProperties false on every object', () => {
    const errors = checkOutputSchema({ type: 'object', required: [], properties: {} })
    expect(errors).toContain('outputSchema: additionalProperties doit valoir false')
  })
  it('rejects keywords outside the supported subset', () => {
    const errors = checkOutputSchema({
      type: 'object',
      additionalProperties: false,
      required: ['n'],
      properties: { n: { type: 'number', minimum: 0 } },
    })
    expect(errors).toContain('outputSchema.n: mot-clé non autorisé « minimum »')
  })
  it('rejects $ref', () => {
    const errors = checkOutputSchema({ type: 'object', additionalProperties: false, required: [], properties: {}, $ref: '#' })
    expect(errors).toContain('outputSchema: mot-clé non autorisé « $ref »')
  })
  it('rejects invisible characters hidden in a description', () => {
    const errors = checkOutputSchema({
      type: 'object',
      additionalProperties: false,
      required: ['a'],
      properties: { a: { type: 'string', description: 'texte​caché' } },
    })
    expect(errors).toContain('outputSchema: caractères invisibles interdits')
  })
  it('rejects a schema that is too large', () => {
    const big = { type: 'object', additionalProperties: false, required: [], properties: {}, description: 'x'.repeat(9000) }
    expect(checkOutputSchema(big)).toEqual(['outputSchema: trop volumineux'])
  })
})

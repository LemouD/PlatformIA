import { describe, expect, it } from 'vitest'
import { validateDraft } from './validate'
import { menuDraft } from '../testing/fixtures'

function errorsOf(input: unknown): string[] {
  const result = validateDraft(input)
  return result.ok ? [] : result.errors
}

describe('validateDraft', () => {
  it('accepts the menu draft', () => {
    expect(validateDraft(menuDraft())).toEqual({ ok: true, draft: menuDraft() })
  })
  it('rejects any tool in v1', () => {
    expect(errorsOf(menuDraft({ tools: ['send_email'] }))).toContain("tools: aucun outil n'est autorisé en v1")
  })
  it('rejects a model outside the list', () => {
    expect(errorsOf({ ...menuDraft(), model: 'claude-opus-4-8' }).length).toBeGreaterThan(0)
  })
  it('rejects limits above the ceilings', () => {
    expect(errorsOf(menuDraft({ limits: { maxRunsPerDay: 500, maxOutputTokens: 4000 } })).length).toBeGreaterThan(0)
  })
  it('rejects unknown properties such as a self-declared risk level', () => {
    expect(errorsOf({ ...menuDraft(), riskLevel: 'read_only' }).length).toBeGreaterThan(0)
  })
  it('rejects invisible characters in the system prompt', () => {
    const tag = String.fromCodePoint(0xe0041)
    expect(errorsOf(menuDraft({ systemPrompt: `Prompt${tag}` }))).toContain('systemPrompt: caractères invisibles interdits')
  })
  it('rejects invisible characters in a label', () => {
    const fields = menuDraft().inputFields.map((f, i) => (i === 0 ? { ...f, label: 'Ingr​édients' } : f))
    expect(errorsOf(menuDraft({ inputFields: fields }))).toContain('inputFields.ingredients.label: caractères invisibles interdits')
  })
  it('rejects duplicated field keys', () => {
    const first = menuDraft().inputFields[0]!
    expect(errorsOf(menuDraft({ inputFields: [first, first] }))).toContain('inputFields: clé en double « ingredients »')
  })
  it('requires choices on a choice field only', () => {
    const fields = [{ key: 'diet', label: 'Régime', type: 'choice' as const, required: true }]
    expect(errorsOf(menuDraft({ inputFields: fields, testInput: {} }))).toContain('inputFields.diet: choices manquant')
  })
  it('rejects test input keys that match no field', () => {
    expect(errorsOf(menuDraft({ testInput: { unknown: 'x' } }))).toContain('testInput: clé inconnue « unknown »')
  })
})

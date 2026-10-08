import { describe, expect, it } from 'vitest'
import { compileOutputSchema } from '../definitions/compile-schema'
import { validateDraft } from '../definitions/validate'
import { validateRunInput } from '../runner/input'
import { renderMarkdown } from './render'
import { WORK_AGENTS } from './work-agents'

describe('work agents catalog', () => {
  it.each(Object.entries(WORK_AGENTS))('%s is a valid fiche with a compilable schema and a valid test input', (_key, draft) => {
    expect(validateDraft(draft)).toEqual({ ok: true, draft })
    expect(compileOutputSchema(draft.outputSchema)).not.toBeNull()
    expect(validateRunInput(draft.inputFields, draft.testInput, []).ok).toBe(true)
  })
  it('has unique names and no tools', () => {
    const drafts = Object.values(WORK_AGENTS)
    expect(new Set(drafts.map((d) => d.name)).size).toBe(drafts.length)
    expect(drafts.every((d) => d.tools.length === 0)).toBe(true)
  })
})

describe('renderMarkdown', () => {
  it('renders headings, fields and lists', () => {
    const text = renderMarkdown('Cadrage', {
      resume: 'Court',
      approcheRecommandee: { approche: 'copilot_studio', alternatives: ['power_automate'] },
      risques: ['Données incomplètes'],
      donneesNecessaires: [{ donnee: 'Devis', source: 'Outlook', disponibilite: 'disponible' }],
    })
    expect(text).toContain('# Cadrage')
    expect(text).toContain('**Resume** : Court')
    expect(text).toContain('## Approche recommandee')
    expect(text).toContain('**Approche** : copilot studio')
    expect(text).toContain('- Données incomplètes')
    expect(text).toContain('**Source** : Outlook')
  })
})

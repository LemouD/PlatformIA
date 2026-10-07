import { z } from 'zod'
import { CEILINGS } from '../limits/ceilings'
import { hasInvisible } from './invisible'
import { checkOutputSchema } from './output-schema'
import {
  ALLOWED_MODELS,
  EFFORTS,
  ENVIRONMENTS,
  INPUT_FIELD_TYPES,
  type ConfiguredAgentDraft,
} from './types'

const fieldSchema = z
  .object({
    key: z.string().regex(/^[a-z][a-z0-9_]{0,39}$/),
    label: z.string().min(1).max(CEILINGS.labelMaxChars),
    type: z.enum(INPUT_FIELD_TYPES),
    required: z.boolean(),
    maxLength: z.number().int().positive().max(CEILINGS.fieldMaxLength).optional(),
    choices: z.array(z.string().min(1).max(CEILINGS.labelMaxChars)).min(2).max(20).optional(),
  })
  .strict()

const draftSchema = z
  .object({
    name: z.string().min(1).max(CEILINGS.nameMaxChars),
    objective: z.string().min(1).max(CEILINGS.objectiveMaxChars),
    environment: z.enum(ENVIRONMENTS),
    systemPrompt: z.string().min(1).max(CEILINGS.systemPromptMaxChars),
    inputFields: z.array(fieldSchema).min(1).max(CEILINGS.inputFieldsMax),
    outputSchema: z.record(z.string(), z.unknown()),
    model: z.enum(ALLOWED_MODELS),
    effort: z.enum(EFFORTS),
    limits: z
      .object({
        maxRunsPerDay: z.number().int().min(1).max(CEILINGS.maxRunsPerDay),
        maxOutputTokens: z.number().int().min(256).max(CEILINGS.maxOutputTokens),
      })
      .strict(),
    tools: z.array(z.string()),
    testInput: z.record(z.string(), z.string()),
  })
  .strict()

export type DraftValidation = { ok: true; draft: ConfiguredAgentDraft } | { ok: false; errors: string[] }

/** The creator is never taken at its word: every proposed fiche goes through this function. */
export function validateDraft(input: unknown): DraftValidation {
  const parsed = draftSchema.safeParse(input)
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) }
  }
  const draft: ConfiguredAgentDraft = parsed.data
  const errors: string[] = []

  if (draft.tools.length > 0) errors.push("tools: aucun outil n'est autorisé en v1")

  const keys = new Set<string>()
  for (const field of draft.inputFields) {
    if (keys.has(field.key)) errors.push(`inputFields: clé en double « ${field.key} »`)
    keys.add(field.key)
    if (field.type === 'choice' && !field.choices) errors.push(`inputFields.${field.key}: choices manquant`)
    if (field.type !== 'choice' && field.choices) errors.push(`inputFields.${field.key}: choices réservé aux champs choice`)
  }
  for (const key of Object.keys(draft.testInput)) {
    if (!keys.has(key)) errors.push(`testInput: clé inconnue « ${key} »`)
  }

  const texts: [string, string][] = [
    ['name', draft.name],
    ['objective', draft.objective],
    ['systemPrompt', draft.systemPrompt],
  ]
  for (const field of draft.inputFields) {
    texts.push([`inputFields.${field.key}.label`, field.label])
    for (const choice of field.choices ?? []) texts.push([`inputFields.${field.key}.choices`, choice])
  }
  for (const [path, text] of texts) {
    if (hasInvisible(text)) errors.push(`${path}: caractères invisibles interdits`)
  }

  errors.push(...checkOutputSchema(draft.outputSchema))

  return errors.length > 0 ? { ok: false, errors } : { ok: true, draft }
}

import { hasInvisible } from '../definitions/invisible'
import type { InputField } from '../definitions/types'
import { CEILINGS } from '../limits/ceilings'

/** Keeps only values that fit the chosen agent's form. Anything doubtful is dropped, never repaired. */
export function sanitizePrefill(fields: InputField[], prefill: { key: string; value: string }[]): Record<string, string> {
  const byKey = new Map(fields.map((f) => [f.key, f]))
  const out: Record<string, string> = {}
  for (const { key, value } of prefill) {
    const field = byKey.get(key)
    if (!field || field.type === 'attachment') continue
    if (hasInvisible(value)) continue
    if (value.length > (field.maxLength ?? CEILINGS.fieldMaxLength)) continue
    if (field.type === 'number' && (value.trim() === '' || !Number.isFinite(Number(value)))) continue
    if (field.type === 'choice' && !(field.choices ?? []).includes(value)) continue
    out[key] = value
  }
  return out
}

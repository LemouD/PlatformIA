import { stripInvisible } from '@/domain/sanitize'

/** One list of invisible characters for the whole project: the shared one in src/domain/sanitize.ts. */
export { hasInvisible, stripInvisible } from '@/domain/sanitize'

/** Strips every value of a record and reports whether anything was removed. */
export function stripInvisibleValues(values: Record<string, string>): { values: Record<string, string>; stripped: boolean } {
  let stripped = false
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(values)) {
    const result = stripInvisible(value)
    stripped ||= result.stripped
    out[key] = result.value
  }
  return { values: out, stripped }
}

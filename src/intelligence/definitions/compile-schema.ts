import { Ajv, type ValidateFunction } from 'ajv'
import { checkOutputSchema } from './output-schema'
import type { JsonSchema } from './types'

/**
 * ajv turns a schema into JavaScript (new Function): the only code generation surface of the project.
 * A fiche's schema comes from a model, so it must pass our restricted meta-check before ajv sees it.
 * Server-side only.
 */
const ajv = new Ajv({ strict: true, $data: false, allErrors: false, addUsedSchema: false })
/** Keyed by the serialised schema, since stores return fresh objects on every read. */
const cache = new Map<string, ValidateFunction>()
const CACHE_MAX = 200

/** Returns a validator, or null when the schema is outside the accepted subset (it is then never compiled). */
export function compileOutputSchema(schema: unknown): ValidateFunction | null {
  if (checkOutputSchema(schema).length > 0) return null
  const key = JSON.stringify(schema)
  let validate = cache.get(key)
  if (!validate) {
    try {
      validate = ajv.compile(schema as JsonSchema)
    } catch {
      return null
    }
    if (cache.size >= CACHE_MAX) cache.clear()
    cache.set(key, validate)
  }
  return validate
}

import type { JsonSchema } from '../../definitions/types'
import type { StoredRecord } from '../types'

// Schemas within the accepted subset (no maxLength): sizes are checked by the code in `plan`.

export const str = (description: string): JsonSchema => ({ type: 'string', description })
export const bool = (description: string): JsonSchema => ({ type: 'boolean', description })
export const nullable = (schema: JsonSchema): JsonSchema => ({ anyOf: [schema, { type: 'null' }] })
export const strings = (description: string): JsonSchema => ({ type: 'array', items: { type: 'string' }, description })

/** Every property required and no other: what strict tool use expects. */
export function obj(properties: Record<string, JsonSchema>): JsonSchema {
  return { type: 'object', properties, required: Object.keys(properties), additionalProperties: false }
}

/** One line per record for the model, with its id and, when it applies, its external origin. */
export function line(record: StoredRecord, text: string): string {
  return `[${record.id}]${record.origin === 'externe' ? ' (origine externe)' : ''} ${text}`
}

export const readsExternal = (records: StoredRecord[]) => records.some((r) => r.origin === 'externe')

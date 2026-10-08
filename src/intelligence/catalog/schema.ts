import type { JsonSchema } from '../definitions/types'

/** Small builders for output schemas inside the accepted subset: every object lists all its properties as required. */
export const str = (description?: string): JsonSchema => (description ? { type: 'string', description } : { type: 'string' })

export const oneOf = (values: readonly string[], description?: string): JsonSchema =>
  description ? { type: 'string', enum: [...values], description } : { type: 'string', enum: [...values] }

export const list = (items: JsonSchema): JsonSchema => ({ type: 'array', items })

export const strings = (description?: string): JsonSchema => list(str(description))

export const obj = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  additionalProperties: false,
  required: Object.keys(properties),
  properties,
})

import { CEILINGS } from '../limits/ceilings'
import { hasInvisible } from './invisible'

const ALLOWED_KEYS = new Set([
  'type',
  'properties',
  'required',
  'items',
  'enum',
  'const',
  'anyOf',
  'description',
  'title',
  'additionalProperties',
])
const ALLOWED_TYPES = new Set(['string', 'number', 'integer', 'boolean', 'object', 'array', 'null'])
/** The creator's own schema needs 7 levels (proposal > field > choices > item). */
const MAX_DEPTH = 8

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isPrimitive(value: unknown): boolean {
  return value === null || ['string', 'number', 'boolean'].includes(typeof value)
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') out.push(value)
  else if (Array.isArray(value)) value.forEach((v) => collectStrings(v, out))
  else if (isRecord(value)) {
    for (const [k, v] of Object.entries(value)) {
      out.push(k)
      collectStrings(v, out)
    }
  }
}

function walk(node: unknown, path: string, depth: number, errors: string[]): void {
  if (depth > MAX_DEPTH) {
    errors.push(`${path}: profondeur maximale dépassée`)
    return
  }
  if (!isRecord(node)) {
    errors.push(`${path}: nœud invalide`)
    return
  }
  for (const key of Object.keys(node)) {
    if (!ALLOWED_KEYS.has(key)) errors.push(`${path}: mot-clé non autorisé « ${key} »`)
  }
  if (node.type !== undefined && (typeof node.type !== 'string' || !ALLOWED_TYPES.has(node.type))) {
    errors.push(`${path}: type invalide`)
  }
  if ('const' in node && !isPrimitive(node.const)) errors.push(`${path}: const doit être une valeur simple`)
  if ('enum' in node && !(Array.isArray(node.enum) && node.enum.every(isPrimitive))) {
    errors.push(`${path}: enum doit être une liste de valeurs simples`)
  }
  if (node.type === 'object') {
    if (node.additionalProperties !== false) errors.push(`${path}: additionalProperties doit valoir false`)
    const properties = node.properties
    if (!isRecord(properties)) {
      errors.push(`${path}: properties manquant`)
      return
    }
    const required = node.required
    if (!Array.isArray(required) || !required.every((k) => typeof k === 'string' && Object.hasOwn(properties, k))) {
      errors.push(`${path}: required invalide`)
    }
    for (const [key, child] of Object.entries(properties)) walk(child, `${path}.${key}`, depth + 1, errors)
  }
  if (node.type === 'array') {
    if (node.items === undefined) errors.push(`${path}: items manquant`)
    else walk(node.items, `${path}[]`, depth + 1, errors)
  }
  if (Array.isArray(node.anyOf)) {
    node.anyOf.forEach((child, i) => walk(child, `${path}.anyOf[${i}]`, depth + 1, errors))
  }
}

/** Checks that a schema stays inside the subset structured outputs accept. Returns French error lines. */
export function checkOutputSchema(schema: unknown): string[] {
  if (JSON.stringify(schema ?? null).length > CEILINGS.outputSchemaMaxChars) return ['outputSchema: trop volumineux']
  if (!isRecord(schema) || schema.type !== 'object') return ['outputSchema: la racine doit être un objet']
  const errors: string[] = []
  const strings: string[] = []
  collectStrings(schema, strings)
  if (strings.some(hasInvisible)) errors.push('outputSchema: caractères invisibles interdits')
  walk(schema, 'outputSchema', 0, errors)
  return errors
}

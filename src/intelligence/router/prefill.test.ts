import { describe, expect, it } from 'vitest'
import { menuDraft } from '../testing/fixtures'
import { sanitizePrefill } from './prefill'

const fields = [...menuDraft().inputFields, { key: 'photo', label: 'Photo', type: 'attachment' as const, required: false }]

describe('sanitizePrefill', () => {
  it('keeps valid values', () => {
    expect(sanitizePrefill(fields, [{ key: 'ingredients', value: 'riz' }, { key: 'people', value: '4' }])).toEqual({
      ingredients: 'riz',
      people: '4',
    })
  })
  it('drops unknown keys, attachments, wrong types, wrong choices, overlong and invisible values', () => {
    expect(
      sanitizePrefill(fields, [
        { key: 'unknown', value: 'x' },
        { key: 'photo', value: 'data:image/png;base64,AAA' },
        { key: 'people', value: 'beaucoup' },
        { key: 'diet', value: 'cétogène' },
        { key: 'ingredients', value: 'x'.repeat(2001) },
      ]),
    ).toEqual({})
    expect(sanitizePrefill(fields, [{ key: 'ingredients', value: 'riz​' }])).toEqual({})
  })
})

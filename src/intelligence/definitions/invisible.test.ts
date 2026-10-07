import { describe, expect, it } from 'vitest'
import { hasInvisible, stripInvisible } from './invisible'

const TAG_I = String.fromCodePoint(0xe0069)

describe('hasInvisible', () => {
  it('accepts ordinary French text with new lines and tabs', () => {
    expect(hasInvisible('Résume le courrier.\n\tÉchéance : 12 mai.')).toBe(false)
  })
  it.each([
    ['zero-width space', 'a​b'],
    ['right-to-left override', 'a‮b'],
    ['first strong isolate', 'a⁨b'],
    ['Unicode tag block', `ignore${TAG_I}`],
    ['byte order mark', '﻿texte'],
    ['bell control character', 'a\u0007b'],
  ])('rejects %s', (_label, text) => {
    expect(hasInvisible(text)).toBe(true)
  })
})

describe('stripInvisible', () => {
  it('removes every invisible character and reports it', () => {
    expect(stripInvisible(`ok​${TAG_I}‮!`)).toEqual({ value: 'ok!', stripped: true })
  })
  it('leaves clean text untouched', () => {
    expect(stripInvisible('rien à signaler')).toEqual({ value: 'rien à signaler', stripped: false })
  })
})

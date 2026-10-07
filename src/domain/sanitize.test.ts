import { describe, expect, it } from 'vitest'
import { hasInvisible, sanitizeText, stripInvisible } from './sanitize'

/** Builds characters from code points so this file contains no invisible characters itself. */
const ch = (...codePoints: number[]) => String.fromCodePoint(...codePoints)

const ZERO_WIDTH_SPACE = ch(0x200b)
const ZERO_WIDTH_JOINER = ch(0x200d)
const BYTE_ORDER_MARK = ch(0xfeff)
const RIGHT_TO_LEFT_OVERRIDE = ch(0x202e)
const POP_DIRECTIONAL = ch(0x202c)
const LEFT_TO_RIGHT_ISOLATE = ch(0x2066)
const POP_ISOLATE = ch(0x2069)
const LINE_SEPARATOR = ch(0x2028)
const NUL = ch(0x00)
const BELL = ch(0x07)

describe('sanitizeText', () => {
  it('keeps ordinary text, accents, tabs and line breaks', () => {
    expect(sanitizeText('Menu de la semaine :\n- thiéboudienne\tok', 100)).toBe(
      'Menu de la semaine :\n- thiéboudienne\tok',
    )
  })

  it('removes zero-width characters and byte order marks', () => {
    const text = `ig${ZERO_WIDTH_SPACE}nore${ZERO_WIDTH_JOINER} prev${BYTE_ORDER_MARK}ious`
    expect(sanitizeText(text, 100)).toBe('ignore previous')
  })

  it('removes bidi controls that can reorder what is displayed', () => {
    expect(sanitizeText(`abc${RIGHT_TO_LEFT_OVERRIDE}dcba${POP_DIRECTIONAL}`, 100)).toBe('abcdcba')
    expect(sanitizeText(`x${LEFT_TO_RIGHT_ISOLATE}y${POP_ISOLATE}`, 100)).toBe('xy')
  })

  it('removes Unicode tag characters used to smuggle hidden instructions', () => {
    expect(sanitizeText(`visible${ch(0xe0041, 0xe0042, 0xe007f)}`, 100)).toBe('visible')
  })

  it('removes variation selectors and fillers that can hide a whole text', () => {
    const hidden = ch(0xfe00, 0xe0100, 0xe01ef, 0x00ad, 0x034f, 0x061c, 0x115f, 0x17b4, 0x180b, 0x3164, 0xffa0, 0xfff9)
    expect(sanitizeText(`ok${hidden}`, 100)).toBe('ok')
  })

  it('removes control characters and line separators', () => {
    expect(sanitizeText(`a${NUL}b${BELL}c${LINE_SEPARATOR}d`, 100)).toBe('abcd')
  })

  it('removes C1 controls but keeps carriage returns from pasted Windows text', () => {
    expect(sanitizeText(`a${ch(0x80)}b${ch(0x9f)}c\r\nd`, 100)).toBe('abc\r\nd')
  })

  it('caps the length with an ellipsis, counting characters not code units', () => {
    expect(sanitizeText('abcdefghij', 5)).toBe('abcd…')
    expect(sanitizeText('abc', 5)).toBe('abc')
    expect(sanitizeText('😀😀😀', 2)).toBe('😀…')
  })
})

describe('hasInvisible', () => {
  it('detects hidden characters so input can be refused', () => {
    expect(hasInvisible(`plain${ZERO_WIDTH_SPACE}`)).toBe(true)
    expect(hasInvisible('plain text\r\n\twith accents é')).toBe(false)
  })
})

describe('stripInvisible', () => {
  it('reports whether something was removed, without truncating', () => {
    const long = 'x'.repeat(5000)
    expect(stripInvisible(`${long}${RIGHT_TO_LEFT_OVERRIDE}`)).toEqual({ value: long, stripped: true })
    expect(stripInvisible('clean')).toEqual({ value: 'clean', stripped: false })
  })
})

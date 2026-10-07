/**
 * Free text from the engine, the user or external agents is untrusted. These helpers find
 * and remove characters that can hide instructions or reorder text (zero-width, bidi
 * controls, tag characters, variation selectors, fillers) and other control characters.
 * Tab, line feed and carriage return are kept: pasted Windows text and emails use CRLF.
 * Shared by the interface and the engine library, so both apply the same list.
 */

/** Inclusive code point ranges treated as invisible. Written as numbers on purpose. */
const INVISIBLE_RANGES: readonly (readonly [number, number])[] = [
  [0x0000, 0x0008], // C0 controls before tab
  [0x000b, 0x000c], // vertical tab, form feed
  [0x000e, 0x001f], // remaining C0 controls (carriage return 0x0d is kept)
  [0x007f, 0x009f], // delete and C1 controls
  [0x00ad, 0x00ad], // soft hyphen
  [0x034f, 0x034f], // combining grapheme joiner
  [0x061c, 0x061c], // Arabic letter mark
  [0x115f, 0x1160], // Hangul fillers
  [0x17b4, 0x17b5], // Khmer inherent vowels
  [0x180b, 0x180f], // Mongolian variation selectors and vowel separator
  [0x200b, 0x200f], // zero-width space, joiners, LRM / RLM
  [0x2028, 0x2029], // line and paragraph separators
  [0x202a, 0x202e], // bidi embeddings and overrides
  [0x2060, 0x2064], // word joiner, invisible operators
  [0x2066, 0x2069], // bidi isolates
  [0x3164, 0x3164], // Hangul filler
  [0xfe00, 0xfe0f], // variation selectors
  [0xfeff, 0xfeff], // byte order mark
  [0xffa0, 0xffa0], // halfwidth Hangul filler
  [0xfff9, 0xfffb], // interlinear annotation controls
  [0xe0000, 0xe007f], // tag characters
  [0xe0100, 0xe01ef], // variation selectors supplement
]

function isInvisible(char: string): boolean {
  const codePoint = char.codePointAt(0)
  return codePoint !== undefined && INVISIBLE_RANGES.some(([start, end]) => codePoint >= start && codePoint <= end)
}

/** True when the text contains at least one invisible character; use it to refuse input. */
export function hasInvisible(value: string): boolean {
  for (const char of value) if (isInvisible(char)) return true
  return false
}

/** Removes invisible characters without truncating, and says whether anything was removed. */
export function stripInvisible(value: string): { value: string; stripped: boolean } {
  let cleaned = ''
  let stripped = false
  for (const char of value) {
    if (isInvisible(char)) stripped = true
    else cleaned += char
  }
  return { value: cleaned, stripped }
}

export const TEXT_LIMITS = {
  short: 160,
  message: 500,
  preview: 4000,
} as const

/** Removes invisible characters, then caps the length in characters with an ellipsis. */
export function sanitizeText(value: string, limit: number): string {
  const cleaned = stripInvisible(value).value
  const chars = [...cleaned]
  return chars.length > limit ? `${chars.slice(0, limit - 1).join('')}…` : cleaned
}

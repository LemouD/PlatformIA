/**
 * Characters a reviewer cannot see on screen but a model can read:
 * zero-width and bidi controls, the Unicode tag block, BOM, and C0/C1 controls
 * other than tab, line feed and carriage return.
 */
const INVISIBLE_SOURCE =
  '[\\u200B-\\u200F\\u2028\\u2029\\u202A-\\u202E\\u2060-\\u2064\\u2066-\\u2069\\uFEFF\\u{E0000}-\\u{E007F}\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F\\u007F-\\u009F]'

const INVISIBLE_TEST = new RegExp(INVISIBLE_SOURCE, 'u')

export function hasInvisible(text: string): boolean {
  return INVISIBLE_TEST.test(text)
}

export function stripInvisible(text: string): { value: string; stripped: boolean } {
  const value = text.replace(new RegExp(INVISIBLE_SOURCE, 'gu'), '')
  return { value, stripped: value !== text }
}

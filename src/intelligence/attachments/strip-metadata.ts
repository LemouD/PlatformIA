export interface Stripped {
  bytes: Uint8Array
  stripped: boolean
}

function concat(parts: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0))
  let offset = 0
  for (const part of parts) {
    out.set(part, offset)
    offset += part.length
  }
  return out
}

function byteAt(bytes: Uint8Array, index: number): number {
  const value = bytes[index]
  if (value === undefined) throw new Error('fichier tronqué')
  return value
}

/** APP1 (EXIF and XMP, where GPS lives), APP13 (IPTC) and comments. */
const JPEG_DROPPED = new Set([0xe1, 0xed, 0xfe])

export function stripJpegMetadata(bytes: Uint8Array): Stripped {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)]
  let stripped = false
  let i = 2
  while (i + 4 <= bytes.length) {
    if (byteAt(bytes, i) !== 0xff) throw new Error('JPEG invalide')
    const marker = byteAt(bytes, i + 1)
    if (marker === 0xda) {
      parts.push(bytes.subarray(i))
      return { bytes: concat(parts), stripped }
    }
    const length = (byteAt(bytes, i + 2) << 8) | byteAt(bytes, i + 3)
    const end = i + 2 + length
    if (length < 2 || end > bytes.length) throw new Error('JPEG invalide')
    if (JPEG_DROPPED.has(marker)) stripped = true
    else parts.push(bytes.subarray(i, end))
    i = end
  }
  throw new Error('JPEG invalide')
}

const PNG_DROPPED = new Set(['tEXt', 'zTXt', 'iTXt', 'eXIf', 'tIME'])

export function stripPngMetadata(bytes: Uint8Array): Stripped {
  const parts: Uint8Array[] = [bytes.subarray(0, 8)]
  let stripped = false
  let i = 8
  while (i + 12 <= bytes.length) {
    const length =
      ((byteAt(bytes, i) << 24) >>> 0) + (byteAt(bytes, i + 1) << 16) + (byteAt(bytes, i + 2) << 8) + byteAt(bytes, i + 3)
    const type = String.fromCharCode(...bytes.subarray(i + 4, i + 8))
    const end = i + 12 + length
    if (end > bytes.length) throw new Error('PNG invalide')
    if (PNG_DROPPED.has(type)) stripped = true
    else parts.push(bytes.subarray(i, end))
    i = end
    if (type === 'IEND') return { bytes: concat(parts), stripped }
  }
  throw new Error('PNG invalide')
}

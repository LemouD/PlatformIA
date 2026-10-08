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

/**
 * Keeps the image only, up to and including the end-of-image marker. Anything appended after it
 * (for example the MP4 of an Android "motion photo", with its own GPS position) is dropped.
 */
export function stripJpegMetadata(bytes: Uint8Array): Stripped {
  const parts: Uint8Array[] = [bytes.subarray(0, 2)]
  let stripped = false
  let i = 2
  while (i + 2 <= bytes.length) {
    if (byteAt(bytes, i) !== 0xff) throw new Error('JPEG invalide')
    const marker = byteAt(bytes, i + 1)
    if (marker === 0xff) {
      i += 1 // fill byte before a marker
      continue
    }
    if (marker === 0xd9) {
      parts.push(bytes.subarray(i, i + 2))
      return { bytes: concat(parts), stripped: stripped || i + 2 < bytes.length }
    }
    if (i + 4 > bytes.length) throw new Error('JPEG invalide')
    const length = (byteAt(bytes, i + 2) << 8) | byteAt(bytes, i + 3)
    let end = i + 2 + length
    if (length < 2 || end > bytes.length) throw new Error('JPEG invalide')
    if (marker === 0xda) {
      // Entropy-coded data follows the scan header until the next real marker.
      // FF00 (stuffed byte) and FFD0-FFD7 (restart markers) belong to the data.
      while (end + 1 < bytes.length) {
        if (byteAt(bytes, end) === 0xff) {
          const next = byteAt(bytes, end + 1)
          if (next !== 0x00 && !(next >= 0xd0 && next <= 0xd7) && next !== 0xff) break
        }
        end += 1
      }
      if (end + 1 >= bytes.length) throw new Error('JPEG invalide')
    }
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

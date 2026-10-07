import { PDFDocument } from 'pdf-lib'
import { describe, expect, it } from 'vitest'
import { countPdfPages } from './pdf'
import { prepareAttachment } from './prepare'
import { sniffType } from './sniff'
import { stripJpegMetadata, stripPngMetadata } from './strip-metadata'

const bytes = (...values: number[]) => new Uint8Array(values)
const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0))

/** SOI, APP1 "Exif" (GPS would live here), DQT, SOS, image data, EOI. */
function jpegWithExif(): Uint8Array {
  return bytes(
    0xff, 0xd8,
    0xff, 0xe1, 0x00, 0x06, ...ascii('Exif'),
    0xff, 0xdb, 0x00, 0x04, 0x01, 0x02,
    0xff, 0xda, 0x00, 0x02, 0x11, 0x22, 0x33,
    0xff, 0xd9,
  )
}

function pngChunk(type: string, data: number[]): number[] {
  const len = data.length
  return [(len >>> 24) & 255, (len >>> 16) & 255, (len >>> 8) & 255, len & 255, ...ascii(type), ...data, 0, 0, 0, 0]
}

function pngWithText(): Uint8Array {
  return bytes(
    137, 80, 78, 71, 13, 10, 26, 10,
    ...pngChunk('IHDR', [0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]),
    ...pngChunk('tEXt', ascii('GPS 48.85')),
    ...pngChunk('IDAT', [1, 2, 3]),
    ...pngChunk('IEND', []),
  )
}

async function pdfWithPages(pages: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage()
  return doc.save()
}

describe('sniffType', () => {
  it('recognises content, not names', () => {
    expect(sniffType(jpegWithExif())).toBe('image/jpeg')
    expect(sniffType(pngWithText())).toBe('image/png')
    expect(sniffType(new Uint8Array(ascii('%PDF-1.7')))).toBe('application/pdf')
    expect(sniffType(new Uint8Array(ascii('MZ executable')))).toBeNull()
  })
})

describe('metadata stripping', () => {
  it('removes the APP1 segment of a JPEG and keeps the image', () => {
    const { bytes: out, stripped } = stripJpegMetadata(jpegWithExif())
    expect(stripped).toBe(true)
    expect(Buffer.from(out).includes(Buffer.from('Exif'))).toBe(false)
    expect([...out.slice(-2)]).toEqual([0xff, 0xd9])
  })
  it('removes text chunks of a PNG', () => {
    const { bytes: out, stripped } = stripPngMetadata(pngWithText())
    expect(stripped).toBe(true)
    expect(Buffer.from(out).includes(Buffer.from('GPS'))).toBe(false)
  })
})

describe('countPdfPages', () => {
  it('counts pages in an isolated worker', async () => {
    expect(await countPdfPages(await pdfWithPages(3))).toBe(3)
  })
  it('gives up when the worker exceeds its deadline', async () => {
    await expect(countPdfPages(await pdfWithPages(1), { timeoutMs: 1, maxHeapMb: 128 })).rejects.toThrow('timeout')
  })
  it('rejects garbage behind a PDF signature', async () => {
    await expect(countPdfPages(new Uint8Array(ascii('%PDF-1.7 rien du tout')))).rejects.toThrow()
  })
})

describe('prepareAttachment', () => {
  it('rejects a disguised file whatever its name', async () => {
    const result = await prepareAttachment('photo', 'courrier.jpg', new Uint8Array(ascii('MZ executable')))
    expect(result.ok).toBe(false)
  })
  it('rejects a PDF above the page ceiling', async () => {
    const result = await prepareAttachment('doc', 'long.pdf', await pdfWithPages(21))
    expect(result).toEqual({ ok: false, reason: 'PDF trop long (20 pages au plus)' })
  })
  it('prepares a stripped JPEG with its metadata record', async () => {
    const result = await prepareAttachment('photo', 'copie.jpg', jpegWithExif())
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.value.block.type).toBe('image')
    expect(result.value.meta).toMatchObject({ fieldKey: 'photo', name: 'copie.jpg', mediaType: 'image/jpeg', metadataStripped: true })
    expect(result.value.meta.sha256).toMatch(/^[0-9a-f]{64}$/)
  })
  it('prepares a short PDF and counts its pages', async () => {
    const result = await prepareAttachment('doc', 'lettre.pdf', await pdfWithPages(2))
    expect(result).toMatchObject({ ok: true, value: { pages: 2, block: { type: 'pdf' } } })
  })
})

import { createHash } from 'node:crypto'
import { stripInvisible } from '../definitions/invisible'
import { CEILINGS } from '../limits/ceilings'
import type { LlmContentBlock } from '../ports'
import type { AttachmentMeta } from '../records'
import { countPdfPages } from './pdf'
import { sniffType } from './sniff'
import { stripJpegMetadata, stripPngMetadata } from './strip-metadata'

export interface PreparedAttachment {
  block: LlmContentBlock
  meta: AttachmentMeta
  pages: number
}

export type PrepareResult = { ok: true; value: PreparedAttachment } | { ok: false; reason: string }

const reject = (reason: string): PrepareResult => ({ ok: false, reason })

export async function prepareAttachment(fieldKey: string, name: string, bytes: Uint8Array): Promise<PrepareResult> {
  if (bytes.length === 0) return reject('fichier vide')
  if (bytes.length > CEILINGS.attachmentMaxBytes) return reject('fichier trop lourd (10 Mo au plus)')
  const mediaType = sniffType(bytes)
  if (!mediaType) return reject('type non reconnu (JPEG, PNG ou PDF attendu)')

  let data = bytes
  let stripped = false
  let pages = 1
  try {
    if (mediaType === 'image/jpeg') ({ bytes: data, stripped } = stripJpegMetadata(bytes))
    else if (mediaType === 'image/png') ({ bytes: data, stripped } = stripPngMetadata(bytes))
    else pages = await countPdfPages(bytes)
  } catch {
    return reject('fichier illisible ou chiffré')
  }
  if (pages > CEILINGS.pdfMaxPages) return reject(`PDF trop long (${CEILINGS.pdfMaxPages} pages au plus)`)

  const base64 = Buffer.from(data).toString('base64')
  const block: LlmContentBlock =
    mediaType === 'application/pdf' ? { type: 'pdf', base64 } : { type: 'image', mediaType, base64 }
  const meta: AttachmentMeta = {
    fieldKey,
    name: stripInvisible(name).value.slice(0, 200),
    mediaType,
    sizeBytes: data.length,
    sha256: createHash('sha256').update(data).digest('hex'),
    metadataStripped: stripped,
  }
  return { ok: true, value: { block, meta, pages } }
}

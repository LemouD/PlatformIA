import 'server-only'

/**
 * Reads a request body without trusting Content-Length, which a client can fake: bytes are
 * counted as they arrive and reading stops at the first byte over the cap. Every route sets
 * its own cap (chantier 2 caps, 2026-10-16); anything else falls back to DEFAULT_BODY_LIMIT.
 */

export const DEFAULT_BODY_LIMIT = 16 * 1024

export class BodyError extends Error {
  constructor(
    readonly status: 400 | 413 | 415,
    message: string,
  ) {
    super(message)
    this.name = 'BodyError'
  }
}

export async function readCappedBody(request: Request, maxBytes: number = DEFAULT_BODY_LIMIT): Promise<Uint8Array> {
  if (!request.body) return new Uint8Array(0)
  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    total += value.byteLength
    if (total > maxBytes) {
      await reader.cancel()
      throw new BodyError(413, `body over ${maxBytes} bytes`)
    }
    chunks.push(value)
  }
  const body = new Uint8Array(total)
  let offset = 0
  for (const chunk of chunks) {
    body.set(chunk, offset)
    offset += chunk.byteLength
  }
  return body
}

/** A JSON body within the cap. The result is unknown: each route validates it with its schema. */
export async function readJsonBody(request: Request, maxBytes: number = DEFAULT_BODY_LIMIT): Promise<unknown> {
  const mediaType = (request.headers.get('content-type') ?? '').split(';')[0]!.trim().toLowerCase()
  if (mediaType !== 'application/json') throw new BodyError(415, 'body must be JSON')
  const bytes = await readCappedBody(request, maxBytes)
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes))
  } catch {
    throw new BodyError(400, 'body is not valid JSON')
  }
}

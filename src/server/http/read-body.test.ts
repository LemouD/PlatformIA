import { describe, expect, it } from 'vitest'
import { BodyError, readCappedBody, readJsonBody } from './read-body'

function streamed(parts: string[], headers: Record<string, string> = {}): Request {
  const encoder = new TextEncoder()
  let pulled = 0
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      const part = parts[pulled]
      pulled += 1
      if (part === undefined) controller.close()
      else controller.enqueue(encoder.encode(part))
    },
  })
  return new Request('http://127.0.0.1:3000/api/test', { method: 'POST', body, headers, duplex: 'half' } as RequestInit)
}

async function failure(promise: Promise<unknown>): Promise<BodyError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof BodyError) return error
    throw error
  }
  throw new Error('expected a BodyError')
}

describe('capped body', () => {
  it('reads a body within the cap', async () => {
    const bytes = await readCappedBody(streamed(['hello ', 'world']), 11)
    expect(new TextDecoder().decode(bytes)).toBe('hello world')
  })

  it('stops at the first byte over the cap, whatever Content-Length says', async () => {
    const request = streamed(['a'.repeat(8), 'b'.repeat(8), 'c'.repeat(8)], { 'content-length': '4' })
    expect((await failure(readCappedBody(request, 10))).status).toBe(413)
  })
})

describe('JSON body', () => {
  it('parses JSON within the cap', async () => {
    const request = streamed(['{"command":', '"hi"}'], { 'content-type': 'application/json; charset=utf-8' })
    expect(await readJsonBody(request, 100)).toEqual({ command: 'hi' })
  })

  it('refuses another media type, broken JSON and broken UTF-8', async () => {
    expect((await failure(readJsonBody(streamed(['{}'], { 'content-type': 'text/plain' })))).status).toBe(415)
    expect((await failure(readJsonBody(streamed(['{"a":'], { 'content-type': 'application/json' })))).status).toBe(400)
    const invalidUtf8 = new Request('http://127.0.0.1:3000/api/test', {
      method: 'POST',
      body: new Uint8Array([0x7b, 0xff, 0x7d]),
      headers: { 'content-type': 'application/json' },
    })
    expect((await failure(readJsonBody(invalidUtf8))).status).toBe(400)
  })
})

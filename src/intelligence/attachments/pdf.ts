import { Worker } from 'node:worker_threads'

/**
 * pdf-lib parses untrusted files and no longer receives fixes, so it runs in a disposable worker
 * with a memory cap and a deadline: a booby-trapped PDF or a compression bomb kills the worker, not the server.
 */
const WORKER_SOURCE = `
const { parentPort } = require('node:worker_threads')
const { PDFDocument } = require('pdf-lib')
parentPort.once('message', (bytes) => {
  PDFDocument.load(bytes, { updateMetadata: false })
    .then((doc) => parentPort.postMessage({ ok: true, pages: doc.getPageCount() }))
    .catch(() => parentPort.postMessage({ ok: false }))
})
parentPort.postMessage({ ready: true })
`

export interface PdfLimits {
  timeoutMs: number
  maxHeapMb: number
}

export const DEFAULT_PDF_LIMITS: PdfLimits = { timeoutMs: 5000, maxHeapMb: 128 }

/** Starting a worker and loading pdf-lib is not part of the parsing deadline, but is bounded too. */
const STARTUP_TIMEOUT_MS = 30_000

/** Resolves with the page count; rejects on an unreadable or encrypted PDF, a timeout or a memory overrun. */
export function countPdfPages(bytes: Uint8Array, limits: PdfLimits = DEFAULT_PDF_LIMITS): Promise<number> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      resourceLimits: { maxOldGenerationSizeMb: limits.maxHeapMb, maxYoungGenerationSizeMb: 32 },
    })
    let settled = false
    let timer = setTimeout(() => finish(() => reject(new Error('timeout'))), STARTUP_TIMEOUT_MS)
    const finish = (settle: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      settle()
    }
    worker.on('message', (message: { ready?: boolean; ok?: boolean; pages?: number }) => {
      if (message.ready) {
        // The parsing deadline starts when the bytes are handed over.
        clearTimeout(timer)
        timer = setTimeout(() => finish(() => reject(new Error('timeout'))), limits.timeoutMs)
        worker.postMessage(bytes)
        return
      }
      finish(() =>
        message.ok && typeof message.pages === 'number' ? resolve(message.pages) : reject(new Error('unreadable')),
      )
    })
    worker.once('error', () => finish(() => reject(new Error('worker failed'))))
    worker.once('exit', () => finish(() => reject(new Error('worker exited'))))
  })
}

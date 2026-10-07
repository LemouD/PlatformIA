import { Worker } from 'node:worker_threads'

/**
 * pdf-lib parses untrusted files and no longer receives fixes, so it runs in a disposable worker
 * with a memory cap and a deadline: a booby-trapped PDF or a compression bomb kills the worker, not the server.
 */
const WORKER_SOURCE = `
const { parentPort, workerData } = require('node:worker_threads')
const { PDFDocument } = require('pdf-lib')
PDFDocument.load(workerData, { updateMetadata: false })
  .then((doc) => parentPort.postMessage({ ok: true, pages: doc.getPageCount() }))
  .catch(() => parentPort.postMessage({ ok: false }))
`

export interface PdfLimits {
  timeoutMs: number
  maxHeapMb: number
}

export const DEFAULT_PDF_LIMITS: PdfLimits = { timeoutMs: 5000, maxHeapMb: 128 }

/** Resolves with the page count; rejects on an unreadable or encrypted PDF, a timeout or a memory overrun. */
export function countPdfPages(bytes: Uint8Array, limits: PdfLimits = DEFAULT_PDF_LIMITS): Promise<number> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(WORKER_SOURCE, {
      eval: true,
      workerData: bytes,
      resourceLimits: { maxOldGenerationSizeMb: limits.maxHeapMb, maxYoungGenerationSizeMb: 32 },
    })
    let settled = false
    const finish = (settle: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      void worker.terminate()
      settle()
    }
    const timer = setTimeout(() => finish(() => reject(new Error('timeout'))), limits.timeoutMs)
    worker.once('message', (message: { ok: boolean; pages?: number }) =>
      finish(() =>
        message.ok && typeof message.pages === 'number' ? resolve(message.pages) : reject(new Error('unreadable')),
      ),
    )
    worker.once('error', () => finish(() => reject(new Error('worker failed'))))
    worker.once('exit', () => finish(() => reject(new Error('worker exited'))))
  })
}

import type Anthropic from '@anthropic-ai/sdk'
import type { CallSize } from '../limits/budget'
import type { LlmContentBlock } from '../ports'
import type { ChatToolSpec, ConversationTool, TurnRecord } from './types'

/** Data never closes its tag: angle brackets become their full-width look-alikes. */
export function escapeData(text: string): string {
  return text.replace(/</g, '‹').replace(/>/g, '›')
}

/**
 * Tag attributes are produced by the code only, from known values (ids, enums, server dates, numbered names).
 * They are escaped anyway, so a mistake cannot open a tag.
 */
export function dataTag(name: string, attributes: Record<string, string>, body: string): string {
  const attrs = Object.entries(attributes)
    .map(([key, value]) => ` ${key}="${escapeData(value).replace(/"/g, '”')}"`)
    .join('')
  return `<${name}${attrs}>${escapeData(body)}</${name}>`
}

export function dateLine(now: number, timeZone: string): string {
  const formatted = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeStyle: 'short', timeZone }).format(now)
  return dataTag('contexte', {}, `Date : ${formatted} (${timeZone})`)
}

function sdkMedia(block: LlmContentBlock): Anthropic.ContentBlockParam {
  switch (block.type) {
    case 'text':
      return { type: 'text', text: escapeData(block.text) }
    case 'image':
      return { type: 'image', source: { type: 'base64', media_type: block.mediaType, data: block.base64 } }
    case 'pdf':
      return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: block.base64 } }
  }
}

export interface NewMessageParts {
  /** Data blocks that open a segment (summary, later the memories): only on the first turn of a segment. */
  opening: string[]
  /** Data lines produced by the code for this turn (date, confirmed actions, memory changes). */
  notes: string[]
  attachments: LlmContentBlock[]
  /** Her own words, sent as is. */
  typed: string | null
  /** Pasted text, sent as data. */
  pasted: string | null
}

/** The user message of a turn. Everything that did not come from her keyboard is delimited as data. */
export function buildUserMessage(parts: NewMessageParts): Anthropic.MessageParam {
  const content: Anthropic.ContentBlockParam[] = []
  const texts = [...parts.opening, ...parts.notes]
  if (texts.length > 0) content.push({ type: 'text', text: texts.join('\n') })
  parts.attachments.forEach((block, i) => {
    // Numbered name: the real file name never reaches the model.
    const name = `piece-jointe-${i + 1}`
    content.push({ type: 'text', text: `<document origine="piece_jointe" nom="${name}">` })
    content.push(sdkMedia(block))
    content.push({ type: 'text', text: '</document>' })
  })
  if (parts.pasted) content.push({ type: 'text', text: dataTag('texte_colle', {}, parts.pasted) })
  if (parts.typed) content.push({ type: 'text', text: parts.typed })
  return { role: 'user', content }
}

export function toolSpecs(tools: ConversationTool[]): ChatToolSpec[] {
  return tools.map((tool) => ({ name: tool.name, description: tool.description, inputSchema: tool.inputSchema }))
}

/** Characters of text sent to the model, base64 media excluded (counted apart as images and pages). */
export function textChars(messages: Anthropic.MessageParam[]): number {
  let chars = 0
  for (const message of messages) {
    if (typeof message.content === 'string') {
      chars += message.content.length
      continue
    }
    for (const block of message.content) {
      if (block.type === 'text') chars += block.text.length
      else if (block.type === 'thinking') chars += block.thinking.length
      else if (block.type === 'tool_use') chars += JSON.stringify(block.input).length + block.name.length
      else if (block.type === 'tool_result') chars += JSON.stringify(block.content ?? '').length
    }
  }
  return chars
}

/** Upper bound of one model call, without any cache discount. */
export function callSize(
  system: string,
  tools: ChatToolSpec[],
  history: TurnRecord[],
  pending: Anthropic.MessageParam[],
  pendingMedia: { images: number; pdfPages: number },
  maxOutputTokens: number,
): CallSize {
  const media = history.reduce(
    (acc, turn) => ({ images: acc.images + turn.media.images, pdfPages: acc.pdfPages + turn.media.pdfPages }),
    pendingMedia,
  )
  return {
    textChars: system.length + textChars(history.flatMap((turn) => turn.messages)) + textChars(pending),
    schemaChars: JSON.stringify(tools).length,
    images: media.images,
    pdfPages: media.pdfPages,
    maxOutputTokens,
    // A transient error is retried once.
    attempts: 2,
  }
}

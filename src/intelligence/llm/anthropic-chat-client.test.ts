import type Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { toStoredContent } from './anthropic-chat-client'

describe('toStoredContent', () => {
  it('keeps text, thinking and tool calls field by field, and drops the rest', () => {
    const blocks = [
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: 'Bonjour', citations: null },
      { type: 'tool_use', id: 't1', name: 'lire_notes', input: { recherche: 'pain' }, caller: { type: 'direct' } },
      { type: 'redacted_thinking', data: 'opaque' },
      { type: 'server_tool_use', id: 's1', name: 'web_search', input: {} },
    ] as unknown as Anthropic.ContentBlock[]
    expect(toStoredContent(blocks)).toEqual([
      { type: 'thinking', thinking: '', signature: 'sig' },
      { type: 'text', text: 'Bonjour' },
      { type: 'tool_use', id: 't1', name: 'lire_notes', input: { recherche: 'pain' } },
      { type: 'redacted_thinking', data: 'opaque' },
    ])
  })
})

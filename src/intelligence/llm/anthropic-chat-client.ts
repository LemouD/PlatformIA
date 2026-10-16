import Anthropic from '@anthropic-ai/sdk'
import type { ChatLlmClient, ChatRequest, ChatResult } from '../conversation/types'
import { classifyError } from './anthropic-client'

/**
 * Response blocks are rebuilt field by field, so a stored turn holds only what the API needs back.
 * Thinking blocks are kept as returned: they are bound to the conversation and replayed unchanged.
 */
export function toStoredContent(blocks: Anthropic.ContentBlock[]): Anthropic.ContentBlockParam[] {
  return blocks.flatMap((block): Anthropic.ContentBlockParam[] => {
    switch (block.type) {
      case 'text':
        return [{ type: 'text', text: block.text }]
      case 'thinking':
        return [{ type: 'thinking', thinking: block.thinking, signature: block.signature }]
      case 'redacted_thinking':
        return [{ type: 'redacted_thinking', data: block.data }]
      case 'tool_use':
        return [{ type: 'tool_use', id: block.id, name: block.name, input: block.input }]
      default:
        return []
    }
  })
}

/** Server-side only. One client per user: the key is the one of the session's account (section 11.1 of the spec). */
export function createAnthropicChatClient(options: { apiKey: string }): ChatLlmClient {
  const client = new Anthropic({ apiKey: options.apiKey, maxRetries: 0 })

  return {
    async converse(request: ChatRequest): Promise<ChatResult> {
      try {
        const response = await client.messages.create(
          {
            model: request.model,
            max_tokens: request.maxOutputTokens,
            // Breakpoint 1: tools and system prompt, identical on every turn.
            system: [{ type: 'text', text: request.system, cache_control: { type: 'ephemeral' } }],
            tools: request.tools.map((tool) => ({
              name: tool.name,
              description: tool.description,
              input_schema: tool.inputSchema as Anthropic.Tool.InputSchema,
              strict: true,
            })),
            tool_choice: { type: request.toolChoice },
            messages: request.messages,
            // Breakpoint 2: the last block of the request, so the next turn reads the whole history from the cache.
            cache_control: { type: 'ephemeral' },
            output_config: { effort: request.effort },
          },
          { timeout: request.timeoutMs },
        )
        return {
          kind: 'ok',
          stopReason: response.stop_reason,
          content: toStoredContent(response.content),
          model: response.model,
          usage: {
            inputTokens: response.usage.input_tokens,
            cacheWriteTokens: response.usage.cache_creation_input_tokens ?? 0,
            cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
            outputTokens: response.usage.output_tokens,
          },
        }
      } catch (error) {
        return { kind: 'error', ...classifyError(error) }
      }
    },
  }
}

import Anthropic from '@anthropic-ai/sdk'
import type { LlmClient, LlmContentBlock, LlmErrorCause, LlmRequest, LlmResult } from '../ports'

export function toSdkContent(blocks: LlmContentBlock[]): Anthropic.ContentBlockParam[] {
  return blocks.map((block): Anthropic.ContentBlockParam => {
    switch (block.type) {
      case 'text':
        return { type: 'text', text: block.text }
      case 'image':
        return { type: 'image', source: { type: 'base64', media_type: block.mediaType, data: block.base64 } }
      case 'pdf':
        return { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: block.base64 } }
    }
  })
}

/** Builds the cause from the error class only: the API error body is never copied. */
export function classifyError(error: unknown): { cause: LlmErrorCause; retryable: boolean } {
  if (error instanceof Anthropic.APIConnectionTimeoutError) return { cause: 'timeout', retryable: true }
  if (error instanceof Anthropic.APIConnectionError) return { cause: 'network', retryable: true }
  if (error instanceof Anthropic.RateLimitError) return { cause: 'rate_limited', retryable: true }
  if (error instanceof Anthropic.InternalServerError) return { cause: 'overloaded', retryable: true }
  if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
    return { cause: 'auth', retryable: false }
  }
  if (error instanceof Anthropic.BadRequestError) return { cause: 'bad_request', retryable: false }
  return { cause: 'unknown', retryable: false }
}

/** Server-side only. The API key comes from the server environment and never leaves this module. */
export function createAnthropicLlmClient(options: { apiKey: string }): LlmClient {
  const client = new Anthropic({ apiKey: options.apiKey, maxRetries: 0 })

  return {
    async complete(request: LlmRequest): Promise<LlmResult> {
      try {
        const response = await client.messages.create(
          {
            model: request.model,
            max_tokens: request.maxOutputTokens,
            system: request.system,
            messages: [{ role: 'user', content: toSdkContent(request.content) }],
            output_config: {
              effort: request.effort,
              format: { type: 'json_schema', schema: request.outputSchema },
            },
          },
          { timeout: request.timeoutMs },
        )
        const usage = { inputTokens: response.usage.input_tokens, outputTokens: response.usage.output_tokens }
        if (response.stop_reason === 'refusal') return { kind: 'refused', model: response.model, usage }
        if (response.stop_reason === 'max_tokens') return { kind: 'truncated', model: response.model, usage }
        const text = response.content.flatMap((block) => (block.type === 'text' ? [block.text] : [])).join('')
        try {
          return { kind: 'ok', json: JSON.parse(text) as unknown, model: response.model, usage }
        } catch {
          return { kind: 'invalid_json', model: response.model, usage }
        }
      } catch (error) {
        return { kind: 'error', ...classifyError(error) }
      }
    },
  }
}

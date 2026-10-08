import Anthropic from '@anthropic-ai/sdk'
import { describe, expect, it } from 'vitest'
import { classifyError, toSdkContent } from './anthropic-client'

/** Builds an instance of an SDK error class without calling its constructor. */
const instanceOf = (cls: { prototype: object }): unknown => Object.create(cls.prototype)

describe('toSdkContent', () => {
  it('maps text, images and PDFs to SDK blocks', () => {
    expect(
      toSdkContent([
        { type: 'text', text: 'bonjour' },
        { type: 'image', mediaType: 'image/png', base64: 'AAA' },
        { type: 'pdf', base64: 'BBB' },
      ]),
    ).toEqual([
      { type: 'text', text: 'bonjour' },
      { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'AAA' } },
      { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'BBB' } },
    ])
  })
})

describe('classifyError', () => {
  it.each([
    [Anthropic.APIConnectionTimeoutError, 'timeout', true],
    [Anthropic.APIConnectionError, 'network', true],
    [Anthropic.RateLimitError, 'rate_limited', true],
    [Anthropic.InternalServerError, 'overloaded', true],
    [Anthropic.AuthenticationError, 'auth', false],
    [Anthropic.PermissionDeniedError, 'auth', false],
    [Anthropic.BadRequestError, 'bad_request', false],
  ] as const)('classifies %o', (cls, cause, retryable) => {
    expect(classifyError(instanceOf(cls))).toEqual({ cause, retryable })
  })
  it('never forwards the error text', () => {
    expect(classifyError(new Error('sk-ant-secret in body'))).toEqual({ cause: 'unknown', retryable: false })
  })
})

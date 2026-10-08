import { describe, expect, it } from 'vitest'
import { compileOutputSchema } from '../definitions/compile-schema'
import { CREATOR_OUTPUT_SCHEMA } from './creator'
import { NOVA_OUTPUT_SCHEMA } from './nova'

describe('system agent schemas', () => {
  it('pass the restricted schema check and compile', () => {
    expect(compileOutputSchema(CREATOR_OUTPUT_SCHEMA)).not.toBeNull()
    expect(compileOutputSchema(NOVA_OUTPUT_SCHEMA)).not.toBeNull()
  })
})

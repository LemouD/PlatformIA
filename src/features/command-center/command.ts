export const MAX_COMMAND_LENGTH = 500

export const COMMAND_INPUT_ID = 'nova-command-input'

export function normalizeCommand(raw: string): string | null {
  const collapsed = raw.replace(/\s+/g, ' ').trim()
  if (collapsed === '') return null
  return collapsed.slice(0, MAX_COMMAND_LENGTH)
}

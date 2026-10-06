'use client'

import { ArrowUp, Mic, Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { FormEvent } from 'react'
import { COMMAND_INPUT_ID, MAX_COMMAND_LENGTH, normalizeCommand } from './command'

interface CommandInputProps {
  suggestions: readonly string[]
  onSubmit?: (command: string) => void
}

export function CommandInput({ suggestions, onSubmit }: CommandInputProps) {
  const [value, setValue] = useState('')

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const command = normalizeCommand(value)
    if (command === null) return
    onSubmit?.(command)
    setValue('')
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3.5 rounded-panel border border-line-strong bg-surface-command p-5 shadow-glow"
    >
      <div className="flex items-center gap-3.5">
        <span aria-hidden className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent text-white">
          <Sparkles size={15} />
        </span>
        <label htmlFor={COMMAND_INPUT_ID} className="sr-only">
          Command for NOVA
        </label>
        <input
          id={COMMAND_INPUT_ID}
          type="text"
          value={value}
          onChange={(event) => setValue(event.target.value)}
          maxLength={MAX_COMMAND_LENGTH}
          autoComplete="off"
          placeholder="What should I do?"
          className="min-w-0 flex-1 bg-transparent text-lg font-medium text-ink outline-none placeholder:text-ink"
        />
        <button
          type="button"
          disabled
          aria-label="Voice input (unavailable)"
          className="flex size-[35px] shrink-0 items-center justify-center rounded-control bg-surface-raised text-ink-soft disabled:opacity-50"
        >
          <Mic aria-hidden size={15} />
        </button>
        <button
          type="submit"
          aria-label="Send command"
          className="flex size-[35px] shrink-0 items-center justify-center rounded-control bg-accent text-white"
        >
          <ArrowUp aria-hidden size={15} />
        </button>
      </div>

      <ul aria-label="Suggestions" className="flex flex-wrap gap-2">
        {suggestions.map((suggestion) => (
          <li key={suggestion} className="min-w-[160px] flex-1">
            <button
              type="button"
              onClick={() => setValue(suggestion.replace(/\.\.\.$/, ''))}
              className="w-full truncate rounded-control border border-line bg-surface-sunken px-2.5 py-2 text-left text-[9px] text-ink-muted hover:text-ink-soft"
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </form>
  )
}

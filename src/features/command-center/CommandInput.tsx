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
      className="flex flex-col gap-3.5 rounded-panel border border-line-strong bg-surface-command p-4 shadow-glow md:p-5"
    >
      <div className="flex items-center gap-2 md:gap-3.5">
        <span aria-hidden className="hidden size-8 shrink-0 items-center justify-center rounded-full bg-accent text-canvas md:flex">
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
          className="h-12 min-w-0 flex-1 rounded-control border border-line-control bg-surface-sunken px-3 font-display text-lg italic text-ink outline-none placeholder:text-ink md:h-auto md:rounded-none md:border-0 md:bg-transparent md:px-0"
        />
        <button
          type="button"
          disabled
          aria-label="Voice input (unavailable)"
          className="flex size-12 shrink-0 items-center justify-center rounded-control bg-surface-raised text-ink-soft disabled:opacity-50 md:size-[35px]"
        >
          <Mic aria-hidden size={15} />
        </button>
        <button
          type="submit"
          aria-label="Send command"
          className="flex size-12 shrink-0 items-center justify-center rounded-control bg-accent text-canvas md:size-[35px]"
        >
          <ArrowUp aria-hidden size={15} />
        </button>
      </div>

      <ul
        aria-label="Suggestions"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:overflow-visible md:px-0"
      >
        {suggestions.map((suggestion) => (
          <li key={suggestion} className="flex-none md:min-w-[160px] md:flex-1">
            <button
              type="button"
              onClick={() => setValue(suggestion.replace(/\.\.\.$/, ''))}
              className="h-10 w-full truncate whitespace-nowrap rounded-control border border-line-control bg-surface-sunken px-3 text-left text-xs text-ink-muted hover:text-ink-soft md:h-auto md:px-2.5 md:py-2 md:text-[9px]"
            >
              {suggestion}
            </button>
          </li>
        ))}
      </ul>
    </form>
  )
}

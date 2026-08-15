'use client'

import { useState } from 'react'
import type { PlayerConfig } from '@/lib/puzzles/contract'

type Props = {
  config: PlayerConfig
  busy: boolean
  onAttempt: (attempt: { answer: string }) => void | Promise<unknown>
}

export function QuizPlayer({ config, busy, onAttempt }: Props) {
  const question = String(config.question ?? '')
  const mode = config.mode === 'choice' ? 'choice' : 'text'
  const choices = Array.isArray(config.choices) ? config.choices.map(String) : []
  const placeholder = String(config.placeholder ?? 'Deine Antwort')

  const [text, setText] = useState('')

  return (
    <div>
      <p className="text-parchment text-lg text-balance">{question}</p>

      {mode === 'choice' ? (
        <div className="mt-5 grid gap-2">
          {choices.map((choice) => (
            <button
              key={choice}
              type="button"
              disabled={busy}
              onClick={() => onAttempt({ answer: choice })}
              className="border-steel-600/70 bg-steel-900/60 hover:border-brass/60 hover:bg-brass/8 rounded-lg border px-4 py-3 text-left transition-colors disabled:opacity-50"
            >
              {choice}
            </button>
          ))}
        </div>
      ) : (
        <form
          className="mt-5 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            if (text.trim()) onAttempt({ answer: text.trim() })
          }}
        >
          <input
            autoFocus
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder={placeholder}
            maxLength={120}
            disabled={busy}
            className="border-steel-600/70 bg-steel-900/60 text-parchment placeholder:text-fog-dim min-w-0 flex-1 rounded-lg border px-4 py-3"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-5 transition-colors disabled:opacity-40"
          >
            Prüfen
          </button>
        </form>
      )}
    </div>
  )
}

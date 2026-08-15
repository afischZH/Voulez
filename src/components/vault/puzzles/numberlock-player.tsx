'use client'

import { useState } from 'react'
import type { NumberFeedback, PuzzleResult } from '@/lib/client-api'
import type { PlayerConfig } from '@/lib/puzzles/contract'

type Props = {
  config: PlayerConfig
  busy: boolean
  onAttempt: (attempt: { guess: string }) => Promise<PuzzleResult>
}

type Row = { guess: string; exact: number; misplaced: number }

export function NumberlockPlayer({ config, busy, onAttempt }: Props) {
  const length = Number(config.length ?? 4)
  const prompt = String(config.prompt ?? '')

  const [guess, setGuess] = useState('')
  const [history, setHistory] = useState<Row[]>([])

  async function submit() {
    if (guess.length !== length || busy) return
    const attempted = guess
    setGuess('')

    const result = await onAttempt({ guess: attempted })
    if (result.correct) return

    const mark = result.feedback as NumberFeedback | null
    if (mark && typeof mark.exact === 'number') {
      setHistory((rows) => [{ guess: attempted, ...mark }, ...rows])
    }
  }

  return (
    <div>
      <p className="text-parchment text-lg text-balance">
        {prompt || `Welche ${length}-stellige Zahl öffnet dieses Schloss?`}
      </p>

      <form
        className="mt-5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <input
          autoFocus
          inputMode="numeric"
          value={guess}
          onChange={(event) =>
            setGuess(event.target.value.replace(/\D/g, '').slice(0, length))
          }
          placeholder={'·'.repeat(length)}
          disabled={busy}
          aria-label={`${length}-stellige Zahl`}
          className="tnum border-steel-600/70 bg-steel-900/60 text-parchment placeholder:text-fog-dim min-w-0 flex-1 rounded-lg border px-4 py-3 text-xl tracking-[0.4em]"
        />
        <button
          type="submit"
          disabled={busy || guess.length !== length}
          className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-5 transition-colors disabled:opacity-40"
        >
          Prüfen
        </button>
      </form>

      {history.length > 0 && (
        <ol className="mt-5 space-y-1.5" aria-label="Bisherige Versuche">
          {history.map((row, i) => (
            <li
              key={`${row.guess}-${i}`}
              className="border-steel-700 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border px-4 py-2.5 text-sm"
            >
              <span className="tnum text-parchment text-base tracking-[0.3em]">
                {row.guess}
              </span>
              <span className="text-fog">
                <span className="text-brass">{row.exact}</span> an der richtigen Stelle ·{' '}
                <span className="text-parchment">{row.misplaced}</span> enthalten
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

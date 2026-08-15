'use client'

import { useState } from 'react'
import type { PuzzleResult, WordFeedback } from '@/lib/client-api'
import type { PlayerConfig } from '@/lib/puzzles/contract'

type Props = {
  config: PlayerConfig
  busy: boolean
  onAttempt: (attempt: { guess: string }) => Promise<PuzzleResult>
}

type Row = { letters: string[]; marks: string[] }

const MARK_STYLE: Record<string, string> = {
  correct: 'border-brass bg-brass text-ink',
  present: 'border-brass/60 bg-brass/18 text-brass-bright',
  absent: 'border-steel-700 bg-steel-900 text-fog-dim',
}

export function WordlePlayer({ config, busy, onAttempt }: Props) {
  const length = Number(config.length ?? 5)
  const hint = String(config.hint ?? '')

  const [guess, setGuess] = useState('')
  const [rows, setRows] = useState<Row[]>([])

  async function submit() {
    if (guess.length !== length || busy) return
    const attempted = guess
    setGuess('')

    const result = await onAttempt({ guess: attempted })
    if (result.correct) return

    const mark = result.feedback as WordFeedback | null
    if (mark?.marks?.length) {
      setRows((prev) => [...prev, { letters: [...attempted], marks: mark.marks }])
    }
  }

  return (
    <div>
      <p className="text-parchment text-lg text-balance">
        {hint || `Ein Wort mit ${length} Buchstaben.`}
      </p>

      {rows.length > 0 && (
        <ol className="mt-5 space-y-2" aria-label="Bisherige Versuche">
          {rows.map((row, i) => (
            <li key={i} className="flex justify-center gap-1.5">
              {row.letters.map((letter, j) => (
                <span
                  key={j}
                  className={`flex h-11 w-11 items-center justify-center rounded-md border text-lg uppercase ${
                    MARK_STYLE[row.marks[j]] ?? MARK_STYLE.absent
                  }`}
                >
                  {letter}
                </span>
              ))}
            </li>
          ))}
        </ol>
      )}

      <form
        className="mt-5 flex gap-2"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <input
          autoFocus
          value={guess}
          onChange={(event) => setGuess(event.target.value.slice(0, length))}
          maxLength={length}
          disabled={busy}
          aria-label={`Wort mit ${length} Buchstaben`}
          placeholder={'·'.repeat(length)}
          className="border-steel-600/70 bg-steel-900/60 text-parchment placeholder:text-fog-dim min-w-0 flex-1 rounded-lg border px-4 py-3 text-lg tracking-[0.3em] uppercase"
        />
        <button
          type="submit"
          disabled={busy || guess.length !== length}
          className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-5 transition-colors disabled:opacity-40"
        >
          Prüfen
        </button>
      </form>

      <p className="text-fog-dim mt-3 text-sm">
        <span className="bg-brass/90 mr-1.5 inline-block h-2.5 w-2.5 rounded-[2px] align-middle" />
        richtiger Buchstabe, richtige Stelle ·
        <span className="bg-brass/30 mx-1.5 inline-block h-2.5 w-2.5 rounded-[2px] align-middle" />
        kommt vor, andere Stelle
      </p>
    </div>
  )
}

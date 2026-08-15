'use client'

import { Choice, TextArea, TextInput } from '@/components/create/fields'
import type { DraftPuzzle } from '@/lib/draft'

type EditorProps = {
  puzzle: DraftPuzzle
  onChange: (config: Record<string, unknown>) => void
}

/** Ohne Konfiguration lässt sich ein Rätsel nicht speichern — hier steht, was fehlt. */
export function puzzleComplete(puzzle: DraftPuzzle): string | null {
  const config = (puzzle.config ?? {}) as Record<string, unknown>

  switch (puzzle.kind) {
    case 'quiz': {
      if (!String(config.question ?? '').trim()) return 'Frage fehlt'
      if (!String(config.answer ?? '').trim()) return 'Antwort fehlt'
      if (config.mode === 'choice') {
        const choices = (config.choices as string[] | undefined) ?? []
        const filled = choices.filter((c) => c.trim())
        if (filled.length < 2) return 'Mindestens zwei Auswahlmöglichkeiten'
        if (!filled.includes(String(config.answer).trim()))
          return 'Die Antwort muss eine der Auswahlmöglichkeiten sein'
      }
      return null
    }
    case 'numberlock':
      return /^\d{3,5}$/.test(String(config.secret ?? ''))
        ? null
        : 'Drei bis fünf Ziffern'
    case 'wordle': {
      const word = String(config.word ?? '').trim()
      return word.length >= 3 && word.length <= 10 ? null : 'Wort mit 3 bis 10 Buchstaben'
    }
    case 'memory': {
      const symbols = ((config.symbols as string[] | undefined) ?? []).filter((s) =>
        s.trim(),
      )
      if (symbols.length < 3) return 'Mindestens drei Symbole'
      if (new Set(symbols).size !== symbols.length)
        return 'Symbole müssen verschieden sein'
      return null
    }
    default:
      return 'Unbekannter Typ'
  }
}

export function defaultConfig(kind: DraftPuzzle['kind']): Record<string, unknown> {
  switch (kind) {
    case 'quiz':
      return { question: '', mode: 'text', answer: '', choices: ['', ''] }
    case 'numberlock':
      return { secret: '', prompt: '' }
    case 'wordle':
      return { word: '', hint: '' }
    case 'memory':
      return { symbols: ['★', '☾', '✦', '❦'] }
  }
}

export function PuzzleEditor({ puzzle, onChange }: EditorProps) {
  const config = (puzzle.config ?? {}) as Record<string, unknown>
  const set = (patch: Record<string, unknown>) => onChange({ ...config, ...patch })

  if (puzzle.kind === 'quiz') {
    const mode = String(config.mode ?? 'text')
    const choices = ((config.choices as string[] | undefined) ?? ['', '']).slice(0, 6)

    return (
      <div className="space-y-5">
        <TextInput
          label="Frage"
          value={String(config.question ?? '')}
          onChange={(e) => set({ question: e.target.value })}
          placeholder="Wo waren wir das erste Mal essen?"
          maxLength={240}
        />
        <Choice
          label="Antwortform"
          value={mode}
          onChange={(next) => set({ mode: next })}
          options={[
            { value: 'text', label: 'Frei eintippen' },
            { value: 'choice', label: 'Aus Vorgaben wählen' },
          ]}
        />

        {mode === 'choice' && (
          <div>
            <span className="text-2xs text-fog-dim tracking-[0.22em] uppercase">
              Auswahlmöglichkeiten
            </span>
            <div className="mt-2 space-y-2">
              {choices.map((choice, i) => (
                <input
                  key={i}
                  value={choice}
                  onChange={(e) => {
                    const next = [...choices]
                    next[i] = e.target.value
                    set({ choices: next })
                  }}
                  placeholder={`Möglichkeit ${i + 1}`}
                  maxLength={120}
                  className="border-steel-600/70 bg-steel-900/60 text-parchment placeholder:text-fog-dim w-full rounded-lg border px-4 py-2.5"
                />
              ))}
            </div>
            {choices.length < 6 && (
              <button
                type="button"
                onClick={() => set({ choices: [...choices, ''] })}
                className="text-fog hover:text-brass mt-2 text-sm underline underline-offset-4"
              >
                Noch eine
              </button>
            )}
          </div>
        )}

        <TextInput
          label="Richtige Antwort"
          hint={
            mode === 'choice'
              ? 'Muss exakt einer Möglichkeit oben entsprechen.'
              : 'Gross- und Kleinschreibung, Akzente und Satzzeichen sind egal.'
          }
          value={String(config.answer ?? '')}
          onChange={(e) => set({ answer: e.target.value })}
          maxLength={120}
        />
      </div>
    )
  }

  if (puzzle.kind === 'numberlock') {
    return (
      <div className="space-y-5">
        <TextInput
          label="Die gesuchte Zahl"
          hint="Drei bis fünf Ziffern. Etwas mit Bedeutung wirkt am besten — ein Datum, ein Jahr."
          inputMode="numeric"
          value={String(config.secret ?? '')}
          onChange={(e) => set({ secret: e.target.value.replace(/\D/g, '').slice(0, 5) })}
          placeholder="1984"
          className="tnum tracking-[0.4em]"
        />
        <TextInput
          label="Rahmen (optional)"
          value={String(config.prompt ?? '')}
          onChange={(e) => set({ prompt: e.target.value })}
          placeholder="In welchem Jahr sind wir uns begegnet?"
          maxLength={160}
        />
      </div>
    )
  }

  if (puzzle.kind === 'wordle') {
    return (
      <div className="space-y-5">
        <TextInput
          label="Das gesuchte Wort"
          hint="3 bis 10 Buchstaben."
          value={String(config.word ?? '')}
          onChange={(e) => set({ word: e.target.value.slice(0, 10) })}
          placeholder="HERZ"
          className="tracking-[0.3em] uppercase"
        />
        <TextArea
          label="Umschreibung"
          hint="Steht über dem Raster — ohne sie ist das Wort kaum zu finden."
          rows={2}
          value={String(config.hint ?? '')}
          onChange={(e) => set({ hint: e.target.value })}
          maxLength={160}
        />
      </div>
    )
  }

  const symbols = ((config.symbols as string[] | undefined) ?? []).slice(0, 8)
  return (
    <div>
      <span className="text-2xs text-fog-dim tracking-[0.22em] uppercase">
        Symbole ({symbols.length} Paare, {symbols.length * 2} Karten)
      </span>
      <div className="mt-2 flex flex-wrap gap-2">
        {symbols.map((symbol, i) => (
          <input
            key={i}
            value={symbol}
            onChange={(e) => {
              const next = [...symbols]
              next[i] = e.target.value.slice(0, 8)
              set({ symbols: next })
            }}
            aria-label={`Symbol ${i + 1}`}
            className="border-steel-600/70 bg-steel-900/60 text-parchment h-14 w-14 rounded-lg border text-center text-xl"
          />
        ))}
      </div>
      <div className="mt-3 flex gap-4 text-sm">
        {symbols.length < 8 && (
          <button
            type="button"
            onClick={() => set({ symbols: [...symbols, '✿'] })}
            className="text-fog hover:text-brass underline underline-offset-4"
          >
            Paar hinzufügen
          </button>
        )}
        {symbols.length > 3 && (
          <button
            type="button"
            onClick={() => set({ symbols: symbols.slice(0, -1) })}
            className="text-fog hover:text-brass underline underline-offset-4"
          >
            Letztes entfernen
          </button>
        )}
      </div>
      <p className="text-fog-dim mt-3 text-sm">
        Emojis funktionieren auch — 🎬 🍷 ☕️ 🎡 sagen mehr als Symbole.
      </p>
    </div>
  )
}

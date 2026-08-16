'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { fillSample, type TextSample } from '@/lib/samples'

type Props = {
  samples: TextSample[]
  /** Für `{name}` in den Vorlagen. */
  recipientName: string
  /** Der aktuelle Feldinhalt — daran hängt die Markierung und das Rückgängig. */
  value: string
  onPick: (text: string) => void
  /** Kurze Einzeiler stehen als Chips nebeneinander, lange Texte als Karten. */
  variant?: 'cards' | 'chips'
}

/**
 * Eine Handvoll fertiger Texte unter einem Feld, aus denen ausgewählt werden
 * kann. Standardmässig zugeklappt: wer selbst schreiben will, soll nicht erst
 * an fremden Sätzen vorbeiscrollen.
 *
 * Ein Griff daneben darf nichts kosten — der vorherige Inhalt bleibt liegen,
 * bis eine andere Vorlage gewählt oder der Text von Hand geändert wird, und
 * ein Klick auf „Zurück zu deinem Text" holt ihn zurück.
 */
export function TextSamples({
  samples,
  recipientName,
  value,
  onPick,
  variant = 'cards',
}: Props) {
  const [open, setOpen] = useState(false)
  const [previous, setPrevious] = useState<string | null>(null)

  const filled = samples.map((sample) => ({
    ...sample,
    text: fillSample(sample.text, recipientName),
  }))

  function pick(text: string) {
    // Nur der eigene Text ist es wert, aufgehoben zu werden. Wer von einer
    // Vorlage zur nächsten springt, soll beim Rückgängig nicht in der
    // vorherigen Vorlage landen.
    if (!filled.some((sample) => sample.text === value)) setPrevious(value)
    onPick(text)
  }

  function undo() {
    onPick(previous ?? '')
    setPrevious(null)
  }

  // Ein leeres Feld ist nichts, wohin man zurückwollte — der Verweis erscheint
  // nur, wenn wirklich eigener Text verdrängt wurde.
  const restorable = Boolean(previous?.trim()) && previous !== value

  return (
    <div className="-mt-2">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="text-2xs text-fog-dim hover:text-brass tracking-[0.22em] uppercase transition-colors"
        >
          {open ? '− ' : '+ '}
          {samples.length} Beispiele
        </button>

        {restorable && (
          <button
            type="button"
            onClick={undo}
            className="text-fog hover:text-brass text-sm underline underline-offset-4"
          >
            Zurück zu deinem Text
          </button>
        )}
      </div>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <ul
              className={
                variant === 'chips' ? 'mt-3 flex flex-wrap gap-2' : 'mt-3 space-y-2.5'
              }
            >
              {filled.map((sample) => {
                const picked = sample.text === value
                return (
                  <li key={sample.tone}>
                    <button
                      type="button"
                      aria-pressed={picked}
                      onClick={() => pick(sample.text)}
                      className={`w-full rounded-xl border text-left transition-all ${
                        variant === 'chips' ? 'px-4 py-2.5' : 'p-4 hover:-translate-y-0.5'
                      } ${
                        picked
                          ? 'border-brass bg-brass/12'
                          : 'border-steel-600/70 hover:border-brass/50'
                      }`}
                    >
                      <span className="text-2xs text-brass-dim block tracking-[0.22em] uppercase">
                        {sample.tone}
                      </span>
                      <span
                        className={`text-parchment mt-1.5 block text-sm ${
                          variant === 'chips' ? '' : 'whitespace-pre-line'
                        }`}
                      >
                        {sample.text}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <p className="text-fog-dim mt-3 text-sm">
              Übernommener Text lässt sich im Feld darüber frei weiterschreiben.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

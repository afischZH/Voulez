'use client'

import { AnimatePresence, motion } from 'motion/react'

type Props = {
  length: number
  /** Ziffern nach Rätsel-Position, Lücken sind noch ungelöst. */
  digits: (string | null)[]
}

/**
 * Die gefundenen Ziffern bleiben immer sichtbar. Sich eine Kombination zu
 * merken ist keine Aufgabe, die man einem Besucher zumuten sollte.
 */
export function DigitTray({ length, digits }: Props) {
  const found = digits.filter(Boolean).length

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-2xs text-fog-dim tracking-[0.3em] uppercase">
        Gefundene Ziffern {found}/{length}
      </p>
      <ol className="flex gap-2">
        {Array.from({ length }, (_, i) => {
          const digit = digits[i] ?? null
          return (
            <li
              key={i}
              className={`tnum flex h-10 w-8 items-center justify-center rounded border text-lg ${
                digit
                  ? 'border-brass/60 bg-brass/10 text-brass-bright'
                  : 'border-steel-700 bg-steel-900/50 text-fog-dim'
              }`}
            >
              <AnimatePresence mode="wait">
                <motion.span
                  key={digit ?? 'empty'}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.22 }}
                >
                  {digit ?? '·'}
                </motion.span>
              </AnimatePresence>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

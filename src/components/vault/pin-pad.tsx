'use client'

import { useCallback, useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'

type Props = {
  length: number
  value: string
  onChange: (next: string) => void
  onSubmit: () => void
  disabled?: boolean
  error?: string | null
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'] as const

export function PinPad({ length, value, onChange, onSubmit, disabled, error }: Props) {
  const still = useReducedMotion()
  const complete = value.length === length

  const press = useCallback(
    (key: string) => {
      if (disabled) return
      if (key === 'del') return onChange(value.slice(0, -1))
      if (key === 'ok') return complete ? onSubmit() : undefined
      if (value.length < length) onChange(value + key)
    },
    [complete, disabled, length, onChange, onSubmit, value],
  )

  // Physische Tastatur bedient das Pad mit, ohne dass ein Feld fokussiert sein muss.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (/^\d$/.test(event.key)) press(event.key)
      else if (event.key === 'Backspace') press('del')
      else if (event.key === 'Enter') press('ok')
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [press])

  return (
    <div className="w-full max-w-xs">
      <motion.div
        className="flex justify-center gap-2.5"
        animate={error && !still ? { x: [0, -8, 7, -5, 0] } : { x: 0 }}
        transition={{ duration: 0.36 }}
        role="status"
        aria-live="polite"
        aria-label={`${value.length} von ${length} Ziffern eingegeben`}
      >
        {Array.from({ length }, (_, i) => (
          <div
            key={i}
            className={`tnum flex h-13 w-10 items-center justify-center rounded-md border text-xl transition-colors ${
              error
                ? 'border-signal-no/60 text-signal-no'
                : value[i]
                  ? 'border-brass/70 bg-brass/8 text-brass-bright'
                  : 'border-steel-600/70 bg-steel-900/60 text-fog-dim'
            }`}
          >
            {value[i] ?? '·'}
          </div>
        ))}
      </motion.div>

      <p
        className="text-signal-no mt-3 min-h-5 text-center text-sm"
        role="alert"
        aria-live="assertive"
      >
        {error}
      </p>

      <div className="mt-2 grid grid-cols-3 gap-2.5">
        {KEYS.map((key) => {
          const isOk = key === 'ok'
          const isDel = key === 'del'
          return (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              disabled={disabled || (isOk && !complete)}
              aria-label={isDel ? 'Löschen' : isOk ? 'Tresor öffnen' : `Ziffer ${key}`}
              className={`tnum h-14 rounded-lg border text-lg transition-all active:scale-95 disabled:opacity-35 ${
                isOk
                  ? 'border-brass bg-brass/16 text-brass-bright hover:bg-brass/26'
                  : 'brushed border-steel-600/70 text-parchment hover:border-brass/50'
              }`}
            >
              {isDel ? '⌫' : isOk ? 'Öffnen' : key}
            </button>
          )
        })}
      </div>
    </div>
  )
}

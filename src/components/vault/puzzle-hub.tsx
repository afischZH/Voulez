'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { MemoryPlayer } from '@/components/vault/puzzles/memory-player'
import { NumberlockPlayer } from '@/components/vault/puzzles/numberlock-player'
import { QuizPlayer } from '@/components/vault/puzzles/quiz-player'
import { WordlePlayer } from '@/components/vault/puzzles/wordle-player'
import { checkPuzzle, surrenderPuzzle, type PuzzleResult } from '@/lib/client-api'
import type { LockedPuzzle } from '@/lib/vault'

type Props = {
  slug: string
  puzzles: LockedPuzzle[]
  solved: Record<string, string>
  onSolved: (puzzleId: string, position: number, digit: string) => void
  onDone: () => void
}

/** Nach so vielen Fehlversuchen darf man die Ziffer geschenkt bekommen. */
const MERCY_AFTER = 3

export function PuzzleHub({ slug, puzzles, solved, onSolved, onDone }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const open = puzzles.find((p) => p.id === openId) ?? null
  const remaining = puzzles.filter((p) => !solved[p.id])

  return (
    <div className="w-full max-w-2xl">
      <AnimatePresence mode="wait">
        {open ? (
          <motion.div
            key={open.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <PuzzlePanel
              slug={slug}
              puzzle={open}
              onBack={() => setOpenId(null)}
              onSolved={(digit) => {
                onSolved(open.id, open.position, digit)
                setOpenId(null)
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          >
            <h2 className="font-display text-brass text-center text-xl tracking-wide">
              Die Kombination
            </h2>
            <p className="text-fog mt-2 text-center text-sm">
              {remaining.length === 0
                ? 'Alle Ziffern gefunden.'
                : `Noch ${remaining.length} ${remaining.length === 1 ? 'Ziffer' : 'Ziffern'} zu finden.`}
            </p>

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {puzzles.map((puzzle, index) => {
                const digit = solved[puzzle.id]
                return (
                  <li key={puzzle.id}>
                    <button
                      type="button"
                      onClick={() => !digit && setOpenId(puzzle.id)}
                      disabled={Boolean(digit)}
                      className={`flex w-full items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                        digit
                          ? 'border-brass/50 bg-brass/8'
                          : 'brushed border-steel-600/70 hover:border-brass/60 hover:-translate-y-0.5'
                      }`}
                    >
                      <span
                        className={`tnum flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-lg ${
                          digit
                            ? 'bg-brass text-ink'
                            : 'bg-steel-800 text-fog-dim ring-steel-600 ring-1'
                        }`}
                      >
                        {digit ?? index + 1}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate">
                          {puzzle.title ?? `Rätsel ${index + 1}`}
                        </span>
                        <span className="text-fog block text-sm">
                          {digit ? 'Gelöst' : 'Ungelöst'}
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>

            <div className="mt-7 text-center">
              <button
                type="button"
                onClick={onDone}
                className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-6 py-3 transition-colors"
              >
                {remaining.length === 0 ? 'Zum Tresor' : 'Trotzdem probieren'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function PuzzlePanel({
  slug,
  puzzle,
  onBack,
  onSolved,
}: {
  slug: string
  puzzle: LockedPuzzle
  onBack: () => void
  onSolved: (digit: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [misses, setMisses] = useState(0)
  const [wrong, setWrong] = useState(false)
  const [stuckLongEnough, setStuckLongEnough] = useState(false)

  // Wer 60 Sekunden grübelt, bekommt den Hinweis ungefragt angeboten.
  useEffect(() => {
    const timer = setTimeout(() => setStuckLongEnough(true), 60_000)
    return () => clearTimeout(timer)
  }, [])

  const showHint = Boolean(puzzle.hint) && (stuckLongEnough || misses >= 1)
  const showMercy = misses >= MERCY_AFTER

  // Gibt das Ergebnis zurück, damit Zahlenschloss und Wortraten ihre eigene
  // Versuchsliste führen können, ohne dass der Hub deren Rückmeldung kennt.
  async function attempt(value: unknown): Promise<PuzzleResult> {
    setBusy(true)
    setWrong(false)
    const result = await checkPuzzle(slug, puzzle.id, value)
    setBusy(false)

    if (result.correct) onSolved(result.digit)
    else {
      setWrong(true)
      setMisses((n) => n + 1)
    }
    return result
  }

  async function giveUp() {
    setBusy(true)
    const digit = await surrenderPuzzle(slug, puzzle.id)
    setBusy(false)
    if (digit) onSolved(digit)
  }

  return (
    <div className="brushed border-steel-600/70 rounded-2xl border p-6 sm:p-8">
      <button
        type="button"
        onClick={onBack}
        className="text-fog hover:text-brass text-sm transition-colors"
      >
        ← Zurück
      </button>

      <h2 className="font-display text-brass mt-4 text-lg tracking-wide">
        {puzzle.title ?? 'Rätsel'}
      </h2>

      <div className="mt-4">
        {puzzle.kind === 'quiz' && (
          <QuizPlayer config={puzzle.config} busy={busy} onAttempt={attempt} />
        )}
        {puzzle.kind === 'numberlock' && (
          <NumberlockPlayer config={puzzle.config} busy={busy} onAttempt={attempt} />
        )}
        {puzzle.kind === 'wordle' && (
          <WordlePlayer config={puzzle.config} busy={busy} onAttempt={attempt} />
        )}
        {puzzle.kind === 'memory' && (
          <MemoryPlayer
            slug={slug}
            puzzleId={puzzle.id}
            config={puzzle.config}
            busy={busy}
            onAttempt={attempt}
          />
        )}
      </div>

      <p className="text-signal-no mt-4 min-h-5 text-sm" role="alert" aria-live="polite">
        {wrong ? 'Nicht ganz. Noch einmal?' : ''}
      </p>

      {showHint && (
        <p className="border-brass/30 bg-brass/8 text-fog mt-1 rounded-lg border px-4 py-3 text-sm">
          <span className="text-brass">Hinweis: </span>
          {puzzle.hint}
        </p>
      )}

      {showMercy && (
        <button
          type="button"
          onClick={giveUp}
          disabled={busy}
          className="text-fog hover:text-brass mt-4 text-sm underline underline-offset-4 transition-colors disabled:opacity-50"
        >
          Ich komme nicht drauf — verrate mir die Ziffer
        </button>
      )}
    </div>
  )
}

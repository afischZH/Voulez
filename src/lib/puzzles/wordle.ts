import { z } from 'zod'
import { normalizeAnswer } from '@/lib/crypto'
import type { PuzzleDefinition } from '@/lib/puzzles/contract'

const configSchema = z.object({
  word: z.string().min(3).max(10),
  hint: z.string().max(160).optional(),
})

const attemptSchema = z.object({
  guess: z.string().min(1).max(10),
})

export type WordleConfig = z.infer<typeof configSchema>
export type WordleAttempt = z.infer<typeof attemptSchema>

function letters(value: string): string[] {
  return [...normalizeAnswer(value).replace(/ /g, '')]
}

/**
 * Wortraten im Wordle-Muster. Der Client erfährt nur die Wortlänge und pro
 * Versuch die Farben — nie das Wort selbst.
 */
export const wordle: PuzzleDefinition<WordleConfig, WordleAttempt> = {
  kind: 'wordle',
  configSchema,
  attemptSchema,

  toPlayerConfig(config) {
    return {
      length: letters(config.word).length,
      hint: config.hint ?? '',
    }
  },

  verify(config, attempt) {
    const target = letters(config.word)
    const guess = letters(attempt.guess)
    return guess.length === target.length && guess.join('') === target.join('')
  },

  feedback(config, attempt) {
    const target = letters(config.word)
    const guess = letters(attempt.guess)
    if (guess.length !== target.length) return { marks: [], lengthMismatch: true }

    // Zwei Durchgänge, sonst bekämen doppelte Buchstaben zu viele gelbe
    // Markierungen: erst die Treffer, dann der Rest aus dem verbleibenden Vorrat.
    const marks: string[] = Array(target.length).fill('absent')
    const pool = new Map<string, number>()

    target.forEach((letter, i) => {
      if (guess[i] === letter) marks[i] = 'correct'
      else pool.set(letter, (pool.get(letter) ?? 0) + 1)
    })

    guess.forEach((letter, i) => {
      if (marks[i] === 'correct') return
      const left = pool.get(letter) ?? 0
      if (left > 0) {
        marks[i] = 'present'
        pool.set(letter, left - 1)
      }
    })

    return { marks, lengthMismatch: false }
  },
}

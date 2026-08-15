import { z } from 'zod'
import type { PuzzleDefinition } from '@/lib/puzzles/contract'

const configSchema = z.object({
  secret: z.string().regex(/^\d{3,5}$/),
  /** Frei formulierter Rahmen, z. B. "Das Jahr, in dem wir uns trafen". */
  prompt: z.string().max(160).optional(),
})

const attemptSchema = z.object({
  guess: z.string().regex(/^\d{3,5}$/),
})

export type NumberlockConfig = z.infer<typeof configSchema>
export type NumberlockAttempt = z.infer<typeof attemptSchema>

/**
 * Mastermind mit Ziffern — der Rätseltyp, der am besten zum Tresor passt.
 * Die Rückmeldung nennt nur, wie viele Ziffern richtig stehen und wie viele
 * vorkommen, aber falsch platziert sind. Daraus lässt sich die Zahl
 * erschliessen, ohne dass der Server sie je herausgibt.
 */
export const numberlock: PuzzleDefinition<NumberlockConfig, NumberlockAttempt> = {
  kind: 'numberlock',
  configSchema,
  attemptSchema,

  toPlayerConfig(config) {
    return {
      length: config.secret.length,
      prompt: config.prompt ?? '',
    }
  },

  verify(config, attempt) {
    return attempt.guess === config.secret
  },

  feedback(config, attempt) {
    const secret = [...config.secret]
    const guess = [...attempt.guess]
    if (guess.length !== secret.length) return { exact: 0, misplaced: 0 }

    // Erst die Treffer an richtiger Stelle abziehen, sonst zählt eine Ziffer
    // doppelt — einmal als exakt und einmal als vorhanden.
    const leftoverSecret: string[] = []
    const leftoverGuess: string[] = []
    let exact = 0

    secret.forEach((digit, i) => {
      if (guess[i] === digit) exact += 1
      else {
        leftoverSecret.push(digit)
        leftoverGuess.push(guess[i])
      }
    })

    let misplaced = 0
    for (const digit of leftoverGuess) {
      const at = leftoverSecret.indexOf(digit)
      if (at !== -1) {
        misplaced += 1
        leftoverSecret.splice(at, 1)
      }
    }

    return { exact, misplaced }
  },
}

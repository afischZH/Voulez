import { z } from 'zod'
import { answersMatch } from '@/lib/crypto'
import type { PuzzleDefinition } from '@/lib/puzzles/contract'

/**
 * Der Wizard hält leere Auswahlfelder vor, solange der Ersteller tippt, und
 * behält sie auch, wenn er auf "frei eintippen" umschaltet. Beides darf nicht
 * dazu führen, dass ein fertiges Rätsel abgelehnt wird — also wird vor der
 * Prüfung aufgeräumt.
 */
const configSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== 'object') return raw
    const value = { ...(raw as Record<string, unknown>) }
    if (value.mode === 'choice') {
      value.choices = (Array.isArray(value.choices) ? value.choices : [])
        .map((choice) => String(choice).trim())
        .filter(Boolean)
    } else {
      delete value.choices
    }
    return value
  },
  z.object({
    question: z.string().min(1).max(240),
    /** 'text' = frei eintippen, 'choice' = aus Vorgaben wählen */
    mode: z.enum(['text', 'choice']),
    choices: z.array(z.string().min(1).max(120)).min(2).max(6).optional(),
    answer: z.string().min(1).max(120),
    placeholder: z.string().max(60).optional(),
  }),
)

const attemptSchema = z.object({
  answer: z.string().min(1).max(120),
})

export type QuizConfig = z.infer<typeof configSchema>
export type QuizAttempt = z.infer<typeof attemptSchema>

export const quiz: PuzzleDefinition<QuizConfig, QuizAttempt> = {
  kind: 'quiz',
  configSchema,
  attemptSchema,

  // `answer` fehlt hier bewusst und ist der Grund, warum das Rätsel
  // in den DevTools nicht lösbar ist.
  toPlayerConfig(config) {
    return {
      question: config.question,
      mode: config.mode,
      choices: config.mode === 'choice' ? (config.choices ?? []) : [],
      placeholder: config.placeholder ?? '',
    }
  },

  verify(config, attempt) {
    return answersMatch(attempt.answer, config.answer)
  },
}

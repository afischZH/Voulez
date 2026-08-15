import type { PuzzleDefinition, PuzzleKind } from '@/lib/puzzles/contract'
import { memory } from '@/lib/puzzles/memory'
import { numberlock } from '@/lib/puzzles/numberlock'
import { quiz } from '@/lib/puzzles/quiz'
import { wordle } from '@/lib/puzzles/wordle'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyPuzzle = PuzzleDefinition<any, any>

/** Registry aller Rätseltypen. Ein neuer Typ ist eine Datei plus eine Zeile. */
const registry: Record<string, AnyPuzzle> = {
  quiz,
  memory,
  numberlock,
  wordle,
}

export function puzzleFor(kind: string): AnyPuzzle | null {
  return registry[kind] ?? null
}

export const IMPLEMENTED_KINDS = Object.keys(registry) as PuzzleKind[]

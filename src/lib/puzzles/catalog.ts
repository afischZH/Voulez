import type { PuzzleKind } from '@/lib/puzzles/contract'

/**
 * Bewusst getrennt von der Registry: die zieht über memory.ts `server-only`
 * mit sich, dieser Katalog wird aber im Wizard im Browser gebraucht.
 */
export const PUZZLE_CATALOG: {
  kind: PuzzleKind
  label: string
  tagline: string
  icon: string
}[] = [
  {
    kind: 'quiz',
    label: 'Quiz über uns',
    tagline: 'Eigene Fragen, frei oder zum Anklicken.',
    icon: '?',
  },
  {
    kind: 'numberlock',
    label: 'Zahlenschloss',
    tagline: 'Zahl erraten, mit Hinweis nach jedem Versuch.',
    icon: '◉',
  },
  {
    kind: 'wordle',
    label: 'Wortraten',
    tagline: 'Wort erraten, Buchstaben färben sich ein.',
    icon: 'A',
  },
  {
    kind: 'memory',
    label: 'Memory',
    tagline: 'Paare finden — mit euren eigenen Symbolen.',
    icon: '⧉',
  },
]

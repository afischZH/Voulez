import { z } from 'zod'

export const PUZZLE_KINDS = ['quiz', 'memory', 'numberlock', 'wordle'] as const
export type PuzzleKind = (typeof PUZZLE_KINDS)[number]

/** Was ein Rätsel über sich selbst wissen darf. */
export type PuzzleContext = {
  puzzleId: string
}

/**
 * Ein Rätseltyp besteht immer aus denselben Teilen. Der wichtigste ist
 * `toPlayerConfig`: alles, was diese Funktion nicht zurückgibt, verlässt den
 * Server nie. Die Lösung bleibt damit per Konstruktion in der Datenbank.
 *
 * Ein neuer Typ ist deshalb eine neue Datei plus ein Eintrag in der
 * Registry — keine Änderung an den Route Handlers.
 */
export interface PuzzleDefinition<Config = unknown, Attempt = unknown> {
  kind: PuzzleKind

  /** Validiert die vom Ersteller gespeicherte Konfiguration (inkl. Lösung). */
  configSchema: z.ZodType<Config>

  /** Validiert den Versuch des Besuchers. */
  attemptSchema: z.ZodType<Attempt>

  /** Die einzige Sicht, die der Browser je zu sehen bekommt. */
  toPlayerConfig(config: Config): PlayerConfig

  verify(config: Config, attempt: Attempt, context: PuzzleContext): boolean

  /**
   * Rückmeldung bei falschem Versuch, ohne die Lösung zu verraten —
   * Wordle-Farben, Mastermind-Hinweise. Optional.
   */
  feedback?(config: Config, attempt: Attempt, context: PuzzleContext): Json

  /**
   * Erlaubt dem Client, einen einzelnen Zustand nachzufragen, statt ihn
   * mitgeliefert zu bekommen — Memory deckt so Karte für Karte auf, ohne
   * dass das ganze Kartenbild im DOM liegt. Optional.
   */
  peek?(config: Config, index: number, context: PuzzleContext): Json
}

export type PlayerConfig = Record<string, Json>
export type Json = string | number | boolean | null | Json[] | { [key: string]: Json }

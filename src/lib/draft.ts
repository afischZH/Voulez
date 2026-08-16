import { z } from 'zod'
import { PUZZLE_KINDS } from '@/lib/puzzles/contract'

/**
 * Der Entwurf eines Tresors, wie ihn der Wizard im Browser hält und an den
 * Server schickt. Dieselben Regeln gelten auf beiden Seiten — der Client
 * nutzt sie für die Weiter-Buttons, der Server als Eintrittskontrolle.
 */
export const draftPuzzleSchema = z.object({
  id: z.string(),
  kind: z.enum(PUZZLE_KINDS),
  title: z.string().max(60),
  hint: z.string().max(200),
  /** Die PIN-Ziffer, die dieses Rätsel freigibt. */
  digit: z.string().regex(/^\d$/),
  config: z.unknown(),
})

export const draftSchema = z.object({
  recipientName: z.string().trim().min(1).max(60),
  introText: z.string().trim().max(240),
  revealText: z.string().trim().min(1).max(2000),
  closingText: z.string().trim().max(200),
  creatorName: z.string().trim().max(60),
  creatorEmail: z.email(),
  /** Ob die Bestätigungsmail eine Kopie der Angaben tragen soll. Der Wizard
   *  zeigt sie ohnehin an — mancher will sie zusätzlich im Postfach, mancher
   *  will die PIN nirgends stehen haben. */
  emailSummary: z.boolean().default(true),
  /** Ob der Besuch auch etwas Eigenes vorschlagen darf — eine andere
   *  Unternehmung, einen Termin ausserhalb der angebotenen Fenster. Die
   *  Auswahl des Erstellers bleibt daneben bestehen. */
  allowCustomProposal: z.boolean().default(false),
  timezone: z.string().max(64).default('Europe/Zurich'),
  puzzles: z.array(draftPuzzleSchema).min(2).max(6),
  options: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(40),
        description: z.string().trim().max(120),
      }),
    )
    .min(1)
    .max(8),
  slots: z
    .array(
      z.object({
        day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        from: z.string().regex(/^\d{2}:\d{2}$/),
        to: z.string().regex(/^\d{2}:\d{2}$/),
      }),
    )
    .min(1)
    .max(14),
})

export type Draft = z.infer<typeof draftSchema>
export type DraftPuzzle = z.infer<typeof draftPuzzleSchema>

/** Die PIN ist immer die Folge der Rätsel-Ziffern in ihrer Reihenfolge. */
export function pinFor(puzzles: { digit: string }[]): string {
  return puzzles.map((p) => p.digit).join('')
}

export const OPTION_PRESETS = [
  { label: 'Kaffee', description: 'Eine Stunde, ganz unverbindlich' },
  { label: 'Essen', description: 'Irgendwo, wo es gut ist' },
  { label: 'Kino', description: 'Du suchst den Film aus' },
  { label: 'Spaziergang', description: 'Am Wasser oder im Wald' },
  { label: 'Drink', description: 'Eine Bar, die du noch nicht kennst' },
  { label: 'Ausstellung', description: 'Etwas anschauen und danach reden' },
] as const

export const EMPTY_DRAFT: Draft = {
  recipientName: '',
  introText: '',
  revealText: '',
  closingText: '',
  creatorName: '',
  creatorEmail: '',
  emailSummary: true,
  allowCustomProposal: false,
  timezone: 'Europe/Zurich',
  puzzles: [],
  options: [],
  slots: [],
}

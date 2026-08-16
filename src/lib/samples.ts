import type { PuzzleKind } from '@/lib/puzzles/contract'

/**
 * Vorlagen für die freien Texte im Wizard.
 *
 * Vor dem leeren Feld bleiben die meisten hängen — nicht weil ihnen nichts
 * einfällt, sondern weil der erste Satz der schwerste ist. Die Beispiele sind
 * deshalb keine Bausteine, sondern fertige Texte in verschiedenen Tonlagen:
 * einer davon passt meistens fast, und „fast" lässt sich umschreiben.
 *
 * `{name}` steht für den Namen des Besuchs und wird beim Einsetzen ersetzt.
 */
export type TextSample = {
  /** Die Tonlage, nach der ausgewählt wird — nicht der Titel des Textes. */
  tone: string
  text: string
}

/**
 * Setzt den Namen des Besuchs in eine Vorlage ein.
 *
 * Solange auf Schritt 1 noch kein Name steht, darf kein „, ich frage dich…"
 * mit fehlender Anrede stehen bleiben: die Anrede fällt dann ganz weg und der
 * Satz beginnt gross.
 */
export function fillSample(text: string, recipientName: string): string {
  const name = recipientName.trim()
  if (name) return text.replace(/\{name\}/g, name)

  return text
    .replace(/\{name\}, (\p{Ll})/gu, (_match, first: string) => first.toUpperCase())
    .replace(/\{name\}/g, 'du')
}

/** Der Satz unter dem geschlossenen Tresor — kurz, er steht vor allem anderen. */
export const INTRO_SAMPLES: TextSample[] = [
  {
    tone: 'Nüchtern',
    text: 'Vier Ziffern liegen zwischen dir und dem, was hier drin liegt.',
  },
  {
    tone: 'Verspielt',
    text: 'Ich hätte dir auch einfach schreiben können. Aber wo bleibt da das Vergnügen?',
  },
  {
    tone: 'Direkt',
    text: '{name}, das hier ist für dich. Nimm dir zehn Minuten.',
  },
  {
    tone: 'Leise',
    text: 'Kein Grund zur Eile. Der Tresor läuft dir nicht davon.',
  },
  {
    tone: 'Neugierig',
    text: 'Was drin liegt, ist kürzer als der Weg dorthin. Trotzdem: fang an.',
  },
]

/** Der Text im Tresor — das eigentliche Anliegen. */
export const REVEAL_SAMPLES: TextSample[] = [
  {
    tone: 'Direkt',
    text: `{name}, ich frage dich das lieber, als es weiter vor mir herzuschieben:

Hast du Lust, Zeit mit mir zu verbringen?

Such dir unten aus, was und wann. Um alles andere kümmere ich mich.`,
  },
  {
    tone: 'Verspielt',
    text: `Herzlichen Glückwunsch — du hast dich durch sämtliche Rätsel gearbeitet, nur um eine ziemlich schlichte Frage zu finden:

Gehen wir zusammen weg?

Ein Klick unten genügt, den Rest übernehme ich.`,
  },
  {
    tone: 'Zurückhaltend',
    text: `Ich wollte dich schon länger etwas fragen, und ein beiläufiges „hast du mal Zeit?" kam mir zu billig vor.

Also auf diesem Weg: Hättest du Lust auf einen Abend zu zweit?

Sag ruhig ab, wenn es nicht passt. Sag zu, wenn es passt.`,
  },
  {
    tone: 'Warm',
    text: `{name}, mit dir ist es immer leicht. Genau deshalb frage ich mich in letzter Zeit öfter, warum wir uns eigentlich so selten sehen.

Lass uns das ändern. Such dir aus, worauf du Lust hast — ich richte mich danach.`,
  },
  {
    tone: 'Wiedersehen',
    text: `Wir sagen seit Monaten „wir müssten mal wieder". Ich löse das jetzt einseitig auf.

Unten stehen ein paar Möglichkeiten und ein paar Termine. Wähl eines davon, und es ist abgemacht.`,
  },
]

/**
 * Der Hinweis zu einem Rätsel — er erscheint erst nach dem ersten Fehlversuch
 * oder nach einer Minute.
 *
 * Diese Vorlagen kennen die Lösung nicht und dürfen sie deshalb nie verraten:
 * sie schubsen in eine Richtung („denk an ein Datum") oder nehmen den Druck
 * raus. Was der Ersteller ergänzt, macht daraus einen echten Hinweis. Pro
 * Rätselart, weil ein Memory-Tipp einem Quiz nichts nützt.
 */
export const HINT_SAMPLES: Record<PuzzleKind, TextSample[]> = {
  quiz: [
    { tone: 'Zeitlich', text: 'Es ist länger her, als du denkst.' },
    { tone: 'Vertraulich', text: 'Du hast die Antwort selbst schon einmal gesagt.' },
    { tone: 'Örtlich', text: 'Es hat mit einem Ort zu tun, an dem wir beide waren.' },
    { tone: 'Sanft', text: 'Nicht lange überlegen — dein erster Gedanke stimmt.' },
    { tone: 'Neckisch', text: 'Wenn du raten willst: rate mutig. Es kostet nichts.' },
  ],
  numberlock: [
    { tone: 'Kalender', text: 'Es ist ein Datum. Nichts Zufälliges.' },
    { tone: 'Gemeinsam', text: 'Ein Tag, den wir beide im Kopf haben.' },
    { tone: 'Formal', text: 'Ohne Punkte, ohne Leerzeichen — nur die Ziffern.' },
    { tone: 'Ermutigend', text: 'Zwei Versuche danebenzuliegen ist kein Beinbruch.' },
    { tone: 'Neckisch', text: 'Rückwärts hilft dir nicht weiter. Vorwärts schon.' },
  ],
  wordle: [
    { tone: 'Taktisch', text: 'Fang mit einem Wort an, das viele Vokale hat.' },
    { tone: 'Regelkunde', text: 'Gelb heisst: richtiger Buchstabe, falscher Platz.' },
    {
      tone: 'Persönlich',
      text: 'Das Wort hat mit uns zu tun, nicht mit dem Wörterbuch.',
    },
    { tone: 'Sanft', text: 'Lies die Umschreibung noch einmal, langsam.' },
    { tone: 'Neckisch', text: 'Du sagst dieses Wort öfter, als dir bewusst ist.' },
  ],
  memory: [
    { tone: 'Taktisch', text: 'Merk dir zuerst die Ecken, der Rest ergibt sich.' },
    { tone: 'Systematisch', text: 'Reihe für Reihe statt kreuz und quer.' },
    { tone: 'Ruhig', text: 'Es zählt niemand mit. Lass dir Zeit.' },
    {
      tone: 'Ermutigend',
      text: 'Zwei Runden daneben sind keine verlorenen Runden — danach sitzt das Feld.',
    },
    {
      tone: 'Neckisch',
      text: 'Die Karten liegen noch genau da, wo du sie zuletzt sahst.',
    },
  ],
}

/** Die Zeile ganz unten, rechtsbündig wie eine Unterschrift. */
export const CLOSING_SAMPLES: TextSample[] = [
  { tone: 'Offen', text: 'Such dir aus, was und wann.' },
  { tone: 'Ehrlich', text: 'Ich freu mich. Wirklich.' },
  { tone: 'Ruhig', text: 'Kein Druck. Nur eine Frage.' },
  { tone: 'Knapp', text: 'Bis bald, hoffentlich.' },
  { tone: 'Abgebend', text: 'Der Rest ist deine Entscheidung.' },
]

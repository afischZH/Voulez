import type { Metadata } from 'next'
import { Prose } from '@/components/site/prose'

export const metadata: Metadata = { title: 'Impressum' }

export default function ImprintPage() {
  return (
    <Prose title="Impressum">
      <Todo>
        Vor dem Livegang ausfüllen. Ohne diese Angaben ist der Betrieb in der Schweiz (UWG
        Art. 3 Abs. 1 lit. s) und in der EU nicht zulässig.
      </Todo>

      <h2>Verantwortlich für diese Website</h2>
      <p>
        [Vor- und Nachname]
        <br />
        [Strasse und Nummer]
        <br />
        [PLZ Ort], Schweiz
      </p>

      <h2>Kontakt</h2>
      <p>
        E-Mail: [kontakt@deine-domain.ch]
        <br />
        Für Missbrauchsmeldungen siehe <a href="/melden">Missbrauch melden</a>.
      </p>

      <h2>Haftung für Inhalte</h2>
      <p>
        Die Inhalte der Tresore — Texte, Rätsel, Symbole — stammen von den Nutzerinnen und
        Nutzern, nicht vom Betreiber. Sie werden nicht vorab geprüft. Wer auf
        rechtswidrige Inhalte stösst, meldet sie über das Meldeformular; sie werden nach
        Kenntnis unverzüglich gesperrt.
      </p>

      <h2>Haftung für Links</h2>
      <p>
        Diese Website verlinkt auf externe Kalenderdienste (Google, Apple). Für deren
        Inhalte sind ausschliesslich deren Betreiber verantwortlich.
      </p>
    </Prose>
  )
}

function Todo({ children }: { children: React.ReactNode }) {
  return (
    <p className="border-signal-no/50 bg-signal-no/8 text-parchment rounded-lg border px-4 py-3 text-sm">
      <strong className="text-signal-no">Noch zu erledigen: </strong>
      {children}
    </p>
  )
}

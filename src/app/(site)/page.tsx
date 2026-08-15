import Link from 'next/link'

const STEPS = [
  {
    n: '01',
    title: 'Du versteckst die Einladung',
    body: 'Schreib, was du sagen willst. Es liegt danach hinter einer verschlossenen Tresortür.',
  },
  {
    n: '02',
    title: 'Die Kombination wird erspielt',
    body: 'Quiz, Zahlenschloss, Wortraten, Memory. Jedes gelöste Rätsel gibt eine Ziffer frei.',
  },
  {
    n: '03',
    title: 'Der Tresor geht auf',
    body: 'Erst jetzt erscheint dein Text — vorher steht er nicht einmal im Quelltext der Seite.',
  },
  {
    n: '04',
    title: 'Es wird ein Termin daraus',
    body: 'Art der Unternehmung, Tag und Uhrzeit. Am Ende ein Ticket für den Kalender.',
  },
]

export default function Home() {
  return (
    <>
      <main className="flex flex-col items-center px-6 pt-24 pb-10 text-center">
        <h1 className="font-display text-parchment max-w-2xl text-4xl leading-[1.15] tracking-wide text-balance">
          Frag jemanden nicht.
          <br />
          Lass es ihn finden.
        </h1>

        <p className="text-fog mt-7 max-w-md text-lg leading-relaxed text-balance">
          Eine Einladung, die in einem Tresor liegt. Die Kombination gibt es nur über ein
          paar kleine Rätsel — und am Ende steht ein Ticket im Kalender.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-3">
          <Link
            href="/erstellen"
            className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-7 py-3.5 transition-all hover:-translate-y-0.5"
          >
            Tresor bauen
          </Link>
          <Link
            href="/v/test"
            className="border-steel-600 text-parchment hover:border-brass/60 rounded-lg border px-7 py-3.5 transition-colors"
          >
            Beispiel ansehen
          </Link>
        </div>

        <p className="text-fog-dim mt-5 text-sm">
          Kostenlos, ohne Konto. Die PIN im Beispiel ist 4729 — beim echten Tresor verrät
          sie niemand.
        </p>
      </main>

      <section className="mx-auto w-full max-w-3xl px-6 py-16">
        <ol className="grid gap-x-10 gap-y-9 sm:grid-cols-2">
          {STEPS.map((step) => (
            <li key={step.n}>
              <p className="tnum text-brass-dim font-mono text-sm">{step.n}</p>
              <h2 className="font-display text-parchment mt-2 text-lg tracking-wide">
                {step.title}
              </h2>
              <p className="text-fog mt-2 leading-relaxed">{step.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="mx-auto w-full max-w-3xl px-6 pb-8">
        <div className="border-steel-700 rounded-xl border p-6">
          <h2 className="font-display text-brass text-lg tracking-wide">
            Warum das hier hält, was es verspricht
          </h2>
          <p className="text-fog mt-3 leading-relaxed">
            Rätsellösungen und PIN liegen ausschliesslich auf dem Server. Der Browser
            bekommt die Frage, aber nie die Antwort — und den Einladungstext erst, nachdem
            die richtige Kombination geprüft wurde. Wer die Entwicklerkonsole öffnet,
            findet dort nichts, was das Rätsel abkürzt.
          </p>
        </div>
      </section>
    </>
  )
}

'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { TextArea, TextInput } from '@/components/create/fields'
import {
  defaultConfig,
  PuzzleEditor,
  puzzleComplete,
} from '@/components/create/puzzle-editors'
import { SlotPicker } from '@/components/create/slot-picker'
import { TextSamples } from '@/components/create/text-samples'
import {
  EMPTY_DRAFT,
  OPTION_PRESETS,
  pinFor,
  type Draft,
  type DraftPuzzle,
} from '@/lib/draft'
import { PUZZLE_CATALOG } from '@/lib/puzzles/catalog'
import {
  CLOSING_SAMPLES,
  HINT_SAMPLES,
  INTRO_SAMPLES,
  REVEAL_SAMPLES,
} from '@/lib/samples'
import { formatDay } from '@/lib/time'

const STEPS = [
  'Für wen',
  'Die Rätsel',
  'Der Hinweis',
  'Die Auswahl',
  'Die Zeiten',
  'Vorschau',
  'Abschicken',
] as const

const STORAGE_KEY = 'voulez.draft.v1'

// Ausserhalb der Komponente, weil beide Funktionen bewusst unrein sind und
// nur aus Event-Handlern heraus aufgerufen werden.
let puzzleCounter = 0
const nextPuzzleId = () =>
  `p${(puzzleCounter += 1)}-${Math.random().toString(36).slice(2, 8)}`
const randomDigit = () => String(Math.floor(Math.random() * 10))

export function CreateWizard() {
  const [step, setStep] = useState(0)
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT)
  const [openPuzzle, setOpenPuzzle] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [restored, setRestored] = useState(false)
  /** Läuft gerade ein Absenden? Als Ref, weil die Sperre sofort gelten muss. */
  const sending = useRef(false)

  // Ein halb fertiger Tresor darf einen Tab-Wechsel überleben — ohne Login
  // gibt es sonst keinen Ort, an dem er läge.
  // localStorage existiert erst nach der Hydration. Ein Lazy-Initializer
  // würde Server- und Client-Render auseinanderlaufen lassen, deshalb bleibt
  // es beim Effekt — der eine zusätzliche Render-Durchlauf ist hier gewollt.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) setDraft({ ...EMPTY_DRAFT, ...JSON.parse(saved) })
    } catch {
      // Ein kaputter Eintrag ist kein Grund, den Wizard nicht zu starten.
    }
    setRestored(true)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (restored) localStorage.setItem(STORAGE_KEY, JSON.stringify(draft))
  }, [draft, restored])

  const patch = (values: Partial<Draft>) => setDraft((prev) => ({ ...prev, ...values }))

  function addPuzzle(kind: DraftPuzzle['kind']) {
    const id = nextPuzzleId()
    const entry: DraftPuzzle = {
      id,
      kind,
      title: PUZZLE_CATALOG.find((p) => p.kind === kind)?.label ?? 'Rätsel',
      hint: '',
      digit: randomDigit(),
      config: defaultConfig(kind),
    }
    patch({ puzzles: [...draft.puzzles, entry] })
    setOpenPuzzle(id)
  }

  function updatePuzzle(id: string, values: Partial<DraftPuzzle>) {
    patch({
      puzzles: draft.puzzles.map((p) => (p.id === id ? { ...p, ...values } : p)),
    })
  }

  const blocker = validate(step, draft)

  /**
   * Ein Schritt weiter — die Prüfung steckt im Updater, nicht nur im
   * `disabled` des Knopfes. Zwei schnelle Klicks landen in derselben
   * React-Aktualisierung: der zweite läuft, bevor `disabled` neu gerendert
   * ist, und übersprang so eine ganze Stufe (mit null Rätseln auf „Der
   * Hinweis"). Hier sieht der zweite Aufruf den bereits erhöhten Schritt.
   */
  function goNext() {
    setStep((current) => {
      if (current >= STEPS.length - 1) return current
      return validate(current, draft) ? current : current + 1
    })
  }

  async function submit() {
    // `busy` allein reicht nicht: es wirkt erst nach dem nächsten Rendern,
    // zwei schnelle Klicks lägen davor. Ein zweiter Tresor samt zweiter
    // Bestätigungsmail wäre die Folge.
    if (sending.current) return
    sending.current = true
    setBusy(true)
    setError(null)

    try {
      const res = await fetch('/api/vaults', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const json = await res.json().catch(() => ({}))

      if (!res.ok) return setError(json.message ?? 'Das hat nicht geklappt.')
      localStorage.removeItem(STORAGE_KEY)
      setSent(json.email ?? draft.creatorEmail)
    } catch {
      // Ohne Netz bliebe der Knopf sonst für immer bei „Einen Moment…".
      setError('Keine Verbindung. Versuch es gleich nochmal.')
    } finally {
      setBusy(false)
      sending.current = false
    }
  }

  if (sent) {
    return (
      <Shell>
        <div className="text-center print:hidden">
          <p className="text-2xs text-brass-dim tracking-[0.4em] uppercase">
            Fast fertig
          </p>
          <h1 className="font-display text-parchment mt-4 text-3xl tracking-wide">
            Schau in dein Postfach
          </h1>
          <p className="text-fog mt-4">
            Wir haben eine Bestätigung an{' '}
            <strong className="text-parchment">{sent}</strong> geschickt. Ein Klick darin,
            und der Tresor geht online.
          </p>
          <p className="text-fog-dim mt-6 text-sm">
            Diese E-Mail enthält auch deinen Verwaltungslink. Heb sie auf.
          </p>
        </div>

        {/* Der Entwurf ist aus dem Speicher gelöscht und der Tresor selbst
            bleibt bis zur Bestätigung unsichtbar — dieser Schirm ist der
            einzige Ort, an dem die Angaben jetzt noch stehen. */}
        <section className="border-steel-700 mt-10 border-t pt-8 print:mt-0 print:border-0 print:pt-0">
          <header className="flex flex-wrap items-baseline justify-between gap-3">
            <h2 className="font-display text-brass text-xl tracking-wide">
              Deine Angaben
            </h2>
            <button
              type="button"
              onClick={() => window.print()}
              className="text-fog hover:text-brass text-sm underline underline-offset-4 print:hidden"
            >
              Drucken
            </button>
          </header>

          <div className="mt-6">
            <Summary draft={draft} />
          </div>

          <p className="text-fog-dim mt-6 text-sm print:hidden">
            {draft.emailSummary
              ? 'Dieselben Angaben stehen auch in der Bestätigungsmail.'
              : 'Auf deinen Wunsch stehen diese Angaben nicht in der E-Mail — hier ist der einzige Ort.'}
          </p>
        </section>
      </Shell>
    )
  }

  return (
    <Shell>
      {/* Der aktuelle Schritt ist der einzige, der farblich heraussticht —
          die übrigen bleiben lesbar, statt in Transparenz zu verschwinden. */}
      <ol
        className="mb-9 flex flex-wrap items-center gap-x-2 gap-y-1"
        aria-label={`Schritt ${step + 1} von ${STEPS.length}`}
      >
        {STEPS.map((label, i) => (
          <li
            key={label}
            aria-current={i === step ? 'step' : undefined}
            className={`text-2xs tracking-[0.18em] uppercase ${
              i === step ? 'text-brass' : 'text-fog-dim'
            }`}
          >
            {label}
            {i < STEPS.length - 1 && <span className="text-fog-dim ml-2">/</span>}
          </li>
        ))}
      </ol>

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          {step === 0 && (
            <div className="space-y-6">
              <Heading title="Für wen ist das?" />
              <TextInput
                label="Name"
                hint="Steht eingraviert auf der Tresortür."
                value={draft.recipientName}
                onChange={(e) => patch({ recipientName: e.target.value })}
                placeholder="Alex"
                maxLength={60}
                autoFocus
              />
              <TextArea
                label="Erster Satz (optional)"
                hint="Steht unter dem Tresor, bevor irgendetwas passiert."
                rows={2}
                value={draft.introText}
                onChange={(e) => patch({ introText: e.target.value })}
                placeholder="Vier Ziffern liegen zwischen dir und dem, was hier drin liegt."
                maxLength={240}
              />
              <TextSamples
                samples={INTRO_SAMPLES}
                recipientName={draft.recipientName}
                value={draft.introText}
                onPick={(introText) => patch({ introText })}
                variant="chips"
              />
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <Heading
                title="Woraus besteht die Kombination?"
                sub="Jedes Rätsel gibt eine Ziffer frei. Zwei bis sechs Stück."
              />

              {draft.puzzles.length > 0 && (
                <ul className="space-y-3">
                  {draft.puzzles.map((puzzle, index) => {
                    const missing = puzzleComplete(puzzle)
                    const isOpen = openPuzzle === puzzle.id
                    return (
                      <li
                        key={puzzle.id}
                        className="border-steel-600/70 overflow-hidden rounded-xl border"
                      >
                        <div className="flex items-center gap-3 p-4">
                          <span className="bg-brass text-ink tnum flex h-9 w-9 shrink-0 items-center justify-center rounded-lg">
                            {puzzle.digit}
                          </span>
                          <button
                            type="button"
                            onClick={() => setOpenPuzzle(isOpen ? null : puzzle.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <span className="text-parchment block truncate">
                              {puzzle.title || `Rätsel ${index + 1}`}
                            </span>
                            <span
                              className={`block text-sm ${missing ? 'text-signal-no' : 'text-fog'}`}
                            >
                              {missing ?? 'Fertig'}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              patch({
                                puzzles: draft.puzzles.filter((p) => p.id !== puzzle.id),
                              })
                            }
                            aria-label={`${puzzle.title} entfernen`}
                            className="text-fog-dim hover:text-signal-no -mr-2 flex h-11 w-11 shrink-0 items-center justify-center transition-colors"
                          >
                            ✕
                          </button>
                        </div>

                        {isOpen && (
                          <div className="border-steel-700 space-y-5 border-t p-4 sm:p-5">
                            <TextInput
                              label="Titel auf der Karte"
                              value={puzzle.title}
                              onChange={(e) =>
                                updatePuzzle(puzzle.id, { title: e.target.value })
                              }
                              maxLength={60}
                            />
                            <PuzzleEditor
                              puzzle={puzzle}
                              onChange={(config) => updatePuzzle(puzzle.id, { config })}
                            />
                            <TextInput
                              label="Hinweis (optional)"
                              hint="Wird nach dem ersten Fehlversuch oder nach einer Minute angeboten."
                              value={puzzle.hint}
                              onChange={(e) =>
                                updatePuzzle(puzzle.id, { hint: e.target.value })
                              }
                              maxLength={200}
                            />
                            <TextSamples
                              samples={HINT_SAMPLES[puzzle.kind]}
                              recipientName={draft.recipientName}
                              value={puzzle.hint}
                              onPick={(hint) => updatePuzzle(puzzle.id, { hint })}
                              variant="chips"
                            />
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}

              {draft.puzzles.length < 6 && (
                <div>
                  <p className="text-2xs text-fog-dim tracking-[0.22em] uppercase">
                    Hinzufügen
                  </p>
                  <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                    {PUZZLE_CATALOG.map((entry) => (
                      <li key={entry.kind}>
                        <button
                          type="button"
                          onClick={() => addPuzzle(entry.kind)}
                          className="brushed border-steel-600/70 hover:border-brass/60 flex w-full items-center gap-3 rounded-xl border p-4 text-left transition-all hover:-translate-y-0.5"
                        >
                          <span className="bg-steel-800 text-brass ring-steel-600 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ring-1">
                            {entry.icon}
                          </span>
                          <span className="min-w-0">
                            <span className="text-parchment block">{entry.label}</span>
                            <span className="text-fog block text-sm">
                              {entry.tagline}
                            </span>
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <Heading
                title="Was steht im Tresor?"
                sub="Der Text, der erscheint, sobald die Tür aufgeht."
              />
              <TextArea
                label="Der Hinweis"
                rows={7}
                value={draft.revealText}
                onChange={(e) => patch({ revealText: e.target.value })}
                placeholder={
                  'Ich wollte dich schon länger etwas fragen — und ein simples\n"hast du Zeit?" kam mir zu billig vor.\n\nAlso: hast du Lust, etwas mit mir zu unternehmen?'
                }
                maxLength={2000}
                autoFocus
              />
              <TextSamples
                samples={REVEAL_SAMPLES}
                recipientName={draft.recipientName}
                value={draft.revealText}
                onPick={(revealText) => patch({ revealText })}
              />
              <TextInput
                label="Schlusszeile (optional)"
                hint="Steht rechtsbündig darunter, wie eine Unterschrift."
                value={draft.closingText}
                onChange={(e) => patch({ closingText: e.target.value })}
                placeholder="Such dir aus, was und wann."
                maxLength={200}
              />
              <TextSamples
                samples={CLOSING_SAMPLES}
                recipientName={draft.recipientName}
                value={draft.closingText}
                onPick={(closingText) => patch({ closingText })}
                variant="chips"
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <Heading
                title="Was steht zur Auswahl?"
                sub="Schritt 1 von 2 für deinen Besuch."
              />
              <ul className="grid gap-2.5 sm:grid-cols-2">
                {OPTION_PRESETS.map((preset) => {
                  const picked = draft.options.some((o) => o.label === preset.label)
                  return (
                    <li key={preset.label}>
                      <button
                        type="button"
                        aria-pressed={picked}
                        onClick={() =>
                          patch({
                            options: picked
                              ? draft.options.filter((o) => o.label !== preset.label)
                              : [...draft.options, { ...preset }],
                          })
                        }
                        className={`w-full rounded-xl border p-4 text-left transition-all ${
                          picked
                            ? 'border-brass bg-brass/12'
                            : 'border-steel-600/70 hover:border-brass/50'
                        }`}
                      >
                        <span className="text-parchment block">{preset.label}</span>
                        <span className="text-fog block text-sm">
                          {preset.description}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>

              {draft.options
                .filter((o) => !OPTION_PRESETS.some((p) => p.label === o.label))
                .map((option, i) => (
                  <div
                    key={`custom-${i}`}
                    className="border-brass/40 rounded-xl border p-4"
                  >
                    <p className="text-parchment">{option.label}</p>
                    <p className="text-fog text-sm">{option.description}</p>
                  </div>
                ))}

              <CustomOption
                onAdd={(option) => patch({ options: [...draft.options, option] })}
              />

              {/* Der Gegenentwurf zur Auswahl darüber: wer das anhakt, gibt die
                  Entscheidung ganz aus der Hand — der Besuch darf dann auch
                  etwas nennen, das hier nirgends steht. */}
              <label className="border-steel-600/70 flex cursor-pointer items-start gap-3 rounded-xl border p-4">
                <input
                  type="checkbox"
                  checked={draft.allowCustomProposal}
                  onChange={(e) => patch({ allowCustomProposal: e.target.checked })}
                  className="accent-brass mt-1 h-4 w-4 shrink-0"
                />
                <span>
                  <span className="text-parchment block">Eigener Vorschlag erlaubt</span>
                  <span className="text-fog block text-sm">
                    Dein Besuch darf eine eigene Unternehmung und einen eigenen Tag samt
                    Uhrzeit eintragen — auch ausserhalb deiner Zeitfenster. Du erfährst es
                    in der Zusage-E-Mail.
                  </span>
                </span>
              </label>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <Heading
                title="Wann hättest du Zeit?"
                sub={
                  draft.allowCustomProposal
                    ? 'Diese Fenster schlägst du vor — dein Besuch darf auch einen eigenen Termin nennen.'
                    : 'Nur diese Fenster stehen deinem Besuch zur Wahl.'
                }
              />
              <SlotPicker
                slots={draft.slots}
                timezone={draft.timezone}
                onChange={(slots) => patch({ slots })}
              />
            </div>
          )}

          {step === 5 && (
            <div className="space-y-6">
              <Heading title="Sieht das gut aus?" />
              <Summary draft={draft} />
              <p className="text-fog-dim text-sm">
                Inhalte lassen sich später nicht mehr ändern. Jetzt ist der Moment.
              </p>
            </div>
          )}

          {step === 6 && (
            <div className="space-y-6">
              <Heading
                title="Wohin dürfen wir die Antwort schicken?"
                sub="Du bekommst eine Bestätigungs-E-Mail und später die Zusage."
              />
              <TextInput
                label="Dein Name"
                hint="Steht auf dem Ticket unter „Mit“."
                value={draft.creatorName}
                onChange={(e) => patch({ creatorName: e.target.value })}
                maxLength={60}
              />
              <TextInput
                label="Deine E-Mail"
                type="email"
                inputMode="email"
                value={draft.creatorEmail}
                onChange={(e) => patch({ creatorEmail: e.target.value })}
                placeholder="du@beispiel.ch"
              />
              {/* Die Kombination steht in dieser Zusammenfassung. Wer sein
                  Postfach mit anderen teilt, will genau das nicht. */}
              <label className="border-steel-600/70 flex cursor-pointer items-start gap-3 rounded-xl border p-4">
                <input
                  type="checkbox"
                  checked={draft.emailSummary}
                  onChange={(e) => patch({ emailSummary: e.target.checked })}
                  className="accent-brass mt-1 h-4 w-4 shrink-0"
                />
                <span>
                  <span className="text-parchment block">
                    Zusammenfassung mitschicken
                  </span>
                  <span className="text-fog block text-sm">
                    Deine Angaben samt Kombination stehen dann auch in der
                    Bestätigungsmail. Auf dem nächsten Bildschirm siehst du sie so oder
                    so.
                  </span>
                </span>
              </label>

              <p className="text-fog-dim text-sm">
                Wir nutzen die Adresse nur für diesen Tresor. Nach 90 Tagen wird alles
                gelöscht.
              </p>
              <p className="text-signal-no min-h-5 text-sm" role="alert">
                {error}
              </p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="border-steel-700 mt-10 flex items-center justify-between gap-4 border-t pt-6">
        <button
          type="button"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
          className="text-fog hover:text-brass text-sm underline underline-offset-4 disabled:invisible"
        >
          ← Zurück
        </button>

        <div className="text-right">
          {blocker && <p className="text-fog-dim mb-2 text-sm">{blocker}</p>}
          {step < STEPS.length - 1 ? (
            <button
              type="button"
              disabled={Boolean(blocker)}
              onClick={goNext}
              className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-7 py-3 transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
            >
              Weiter
            </button>
          ) : (
            <button
              type="button"
              disabled={Boolean(blocker) || busy}
              onClick={() => void submit()}
              className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-7 py-3 transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
            >
              {busy ? 'Einen Moment…' : 'Tresor bauen'}
            </button>
          )}
        </div>
      </div>
    </Shell>
  )
}

/** Was fehlt, bevor es weitergehen darf. */
function validate(step: number, draft: Draft): string | null {
  switch (step) {
    case 0:
      return draft.recipientName.trim() ? null : 'Ein Name fehlt noch.'
    case 1: {
      if (draft.puzzles.length < 2) return 'Mindestens zwei Rätsel.'
      const broken = draft.puzzles.find((p) => puzzleComplete(p))
      return broken ? `„${broken.title}“ ist noch nicht fertig.` : null
    }
    case 2:
      return draft.revealText.trim() ? null : 'Ohne Text bleibt der Tresor leer.'
    case 3:
      return draft.options.length ? null : 'Mindestens eine Möglichkeit.'
    case 4:
      return draft.slots.length ? null : 'Mindestens ein Zeitfenster.'
    case 6:
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(draft.creatorEmail)
        ? null
        : 'Eine gültige E-Mail-Adresse fehlt.'
    default:
      return null
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center px-5 py-14">
      <div className="my-auto w-full max-w-xl">{children}</div>
    </main>
  )
}

function Heading({ title, sub }: { title: string; sub?: string }) {
  return (
    <header>
      <h1 className="font-display text-parchment text-2xl tracking-wide text-balance">
        {title}
      </h1>
      {sub && <p className="text-fog mt-2">{sub}</p>}
    </header>
  )
}

/**
 * Alles, was der Ersteller eingetragen hat, an einem Ort — vor dem Abschicken
 * als Kontrolle, danach als Beleg. Beide Male dieselben Zeilen, damit die
 * Vorschau nicht das eine und die Bestätigung das andere zeigt.
 */
function Summary({ draft }: { draft: Draft }) {
  return (
    <dl className="space-y-4">
      <Row label="Für">{draft.recipientName}</Row>
      <Row label="Kombination">
        <span className="tnum text-brass-bright text-xl tracking-[0.3em]">
          {pinFor(draft.puzzles)}
        </span>
        <span className="text-fog-dim mt-1 block text-sm">
          Ergibt sich aus deinen {draft.puzzles.length} Rätseln. Du musst sie dir nicht
          merken.
        </span>
      </Row>
      <Row label="Rätsel">
        {draft.puzzles.map((p, i) => (
          <span key={p.id} className="block">
            <span className="tnum text-brass-dim">{p.digit}</span> —{' '}
            {p.title || `Rätsel ${i + 1}`}
          </span>
        ))}
      </Row>
      <Row label="Zur Auswahl">
        {draft.options.map((o) => o.label).join(' · ')}
        <span className="text-fog-dim mt-1 block text-sm">
          {draft.allowCustomProposal
            ? 'Eigener Vorschlag erlaubt — Unternehmung und Zeitpunkt frei.'
            : 'Nur diese Möglichkeiten, kein eigener Vorschlag.'}
        </span>
      </Row>
      <Row label="Zeitfenster">
        {draft.slots.map((s) => (
          <span key={`${s.day}${s.from}`} className="block">
            {formatDay(s.day, draft.timezone)}, {s.from}–{s.to}
          </span>
        ))}
        <span className="text-fog-dim mt-1 block text-sm">{draft.timezone}</span>
      </Row>
      <Row label="Im Tresor">
        <span className="block whitespace-pre-line">{draft.revealText}</span>
        {draft.closingText && (
          <span className="text-fog mt-2 block text-right italic">
            {draft.closingText}
          </span>
        )}
      </Row>
      {draft.creatorEmail && <Row label="Antwort an">{draft.creatorEmail}</Row>}
    </dl>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-steel-700 border-b pb-4">
      <dt className="text-2xs text-fog-dim tracking-[0.22em] uppercase">{label}</dt>
      <dd className="text-parchment mt-1.5">{children}</dd>
    </div>
  )
}

function CustomOption({
  onAdd,
}: {
  onAdd: (option: { label: string; description: string }) => void
}) {
  const [label, setLabel] = useState('')
  const [description, setDescription] = useState('')

  return (
    <form
      className="border-steel-700 space-y-3 rounded-xl border border-dashed p-4"
      onSubmit={(event) => {
        event.preventDefault()
        if (!label.trim()) return
        onAdd({ label: label.trim(), description: description.trim() })
        setLabel('')
        setDescription('')
      }}
    >
      <p className="text-2xs text-fog-dim tracking-[0.22em] uppercase">Eigene Idee</p>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Konzert"
          maxLength={40}
          className="border-steel-600/70 bg-steel-900/60 text-parchment placeholder:text-fog-dim min-w-0 flex-1 rounded-lg border px-4 py-2.5"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Du suchst die Band aus"
          maxLength={120}
          className="border-steel-600/70 bg-steel-900/60 text-parchment placeholder:text-fog-dim min-w-0 flex-1 rounded-lg border px-4 py-2.5"
        />
        <button
          type="submit"
          disabled={!label.trim()}
          className="border-steel-600 text-parchment hover:border-brass/60 rounded-lg border px-5 py-2.5 transition-colors disabled:opacity-40"
        >
          Hinzu
        </button>
      </div>
    </form>
  )
}

'use client'

import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Ticket, type TicketData } from '@/components/invitation/ticket'
import { formatDay, slotTimes } from '@/lib/time'
import type { LockedVault, OpenedVault } from '@/lib/vault'

type Stage = 'reveal' | 'kind' | 'when' | 'ticket' | 'declined'

const fade = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -14 },
  transition: { duration: 0.38, ease: [0.16, 1, 0.3, 1] as const },
}

export function InvitationFlow({
  slug,
  vault,
  opened,
  emerge = false,
}: {
  slug: string
  vault: LockedVault
  opened: OpenedVault
  /** Kommt direkt aus der Öffnungsanimation — dann steigt der Text aus dem
      Tresor auf, statt einfach da zu sein. */
  emerge?: boolean
}) {
  const still = useReducedMotion()
  const lively = emerge && !still
  const [stage, setStage] = useState<Stage>('reveal')
  const [optionId, setOptionId] = useState<string | null>(null)
  const [day, setDay] = useState<string | null>(null)
  const [time, setTime] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ticket, setTicket] = useState<TicketData | null>(null)

  const days = useMemo(
    () => [...new Set(opened.slots.map((s) => s.day))].sort(),
    [opened.slots],
  )

  const times = useMemo(() => {
    if (!day) return []
    return opened.slots
      .filter((s) => s.day === day)
      .flatMap((s) => slotTimes(s.from.slice(0, 5), s.to.slice(0, 5)))
      .sort()
  }, [day, opened.slots])

  async function submit(accepted: boolean) {
    setBusy(true)
    setError(null)

    const res = await fetch(`/api/v/${encodeURIComponent(slug)}/respond`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(
        accepted
          ? {
              accepted: true,
              optionId,
              day,
              time,
              durationMin: 120,
              message: message.trim() || undefined,
            }
          : { accepted: false, message: message.trim() || undefined },
      ),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)

    if (!res.ok) {
      setError(json.message ?? 'Das hat nicht geklappt. Nochmal versuchen?')
      return
    }

    if (!accepted) return setStage('declined')

    setTicket({
      slug,
      optionLabel: json.ticket.optionLabel,
      startsAt: json.ticket.startsAt,
      durationMin: json.ticket.durationMin,
      message: json.ticket.message,
      recipientName: vault.recipientName,
      hostName: opened.hostName,
      timezone: opened.timezone,
    })
    setStage('ticket')
  }

  if (opened.alreadyAnswered && stage === 'reveal') {
    return (
      <Shell flash={lively}>
        <h1 className="font-display text-brass text-2xl tracking-wide">
          Schon beantwortet
        </h1>
        <p className="text-fog mt-3 max-w-md text-center">
          Dieser Tresor wurde bereits geöffnet und beantwortet.
        </p>
      </Shell>
    )
  }

  return (
    <Shell flash={lively}>
      <AnimatePresence mode="wait">
        {stage === 'reveal' && (
          <motion.section
            key="reveal"
            {...(lively ? {} : fade)}
            className="w-full max-w-xl"
            // Der Text kommt aus der Tiefe des Tresors auf den Leser zu.
            style={lively ? { transformPerspective: 900 } : undefined}
            initial={
              lively
                ? { opacity: 0, scale: 0.52, y: 84, rotateX: 14, filter: 'blur(16px)' }
                : fade.initial
            }
            animate={
              lively
                ? { opacity: 1, scale: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }
                : fade.animate
            }
            transition={
              lively
                ? { duration: 1.25, delay: 0.12, ease: [0.16, 1, 0.3, 1] }
                : fade.transition
            }
          >
            <motion.p
              className="text-2xs text-brass-dim text-center tracking-[0.4em] uppercase"
              initial={lively ? { opacity: 0, letterSpacing: '1.4em' } : false}
              animate={{ opacity: 1, letterSpacing: '0.4em' }}
              transition={{ duration: lively ? 1.4 : 0, ease: [0.16, 1, 0.3, 1] }}
            >
              Der Tresor ist offen
            </motion.p>

            <div className="border-brass/30 bg-brass/6 mt-6 rounded-2xl border p-7 sm:p-9">
              {/* Bewusst NICHT font-display: Cinzel ist eine Gravurschrift.
                  Als Türschild grossartig, als mehrzeiliger Brief mühsam. */}
              <EmergingText text={opened.revealText} emerge={lively} />
              {opened.closingText && (
                <motion.p
                  className="text-fog mt-6 text-right italic"
                  initial={lively ? { opacity: 0, y: 12 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: lively ? 0.8 : 0, delay: lively ? 1.5 : 0 }}
                >
                  {opened.closingText}
                </motion.p>
              )}
            </div>

            <motion.div
              className="mt-8 flex flex-col items-center gap-4"
              initial={lively ? { opacity: 0, y: 16 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: lively ? 0.7 : 0, delay: lively ? 1.75 : 0 }}
            >
              <button
                type="button"
                onClick={() => setStage('kind')}
                className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-7 py-3.5 transition-all hover:-translate-y-0.5"
              >
                Ja — lass uns etwas ausmachen
              </button>
              <button
                type="button"
                onClick={() => submit(false)}
                disabled={busy}
                className="text-fog hover:text-parchment text-sm underline underline-offset-4 transition-colors disabled:opacity-50"
              >
                Vielleicht ein andermal
              </button>
            </motion.div>
          </motion.section>
        )}

        {stage === 'kind' && (
          <motion.section key="kind" {...fade} className="w-full max-w-xl">
            <StepHeading step={1} title="Was machen wir?" />

            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {opened.options.map((option) => (
                <li key={option.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setOptionId(option.id)
                      setStage('when')
                    }}
                    aria-pressed={optionId === option.id}
                    className={`h-full w-full rounded-xl border p-5 text-left transition-all hover:-translate-y-0.5 ${
                      optionId === option.id
                        ? 'border-brass bg-brass/12'
                        : 'brushed border-steel-600/70 hover:border-brass/60'
                    }`}
                  >
                    <span className="text-parchment block text-lg">{option.label}</span>
                    {option.description && (
                      <span className="text-fog mt-1 block text-sm">
                        {option.description}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </motion.section>
        )}

        {stage === 'when' && (
          <motion.section key="when" {...fade} className="w-full max-w-xl">
            <StepHeading step={2} title="Wann passt es dir?" />

            <div className="mt-6">
              <h3 className="text-2xs text-fog-dim tracking-[0.25em] uppercase">Tag</h3>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {days.map((candidate) => (
                  <li key={candidate}>
                    <button
                      type="button"
                      onClick={() => {
                        setDay(candidate)
                        setTime(null)
                      }}
                      aria-pressed={day === candidate}
                      className={`w-full rounded-lg border px-4 py-3 text-left transition-colors ${
                        day === candidate
                          ? 'border-brass bg-brass/12 text-brass-bright'
                          : 'border-steel-600/70 bg-steel-900/60 hover:border-brass/50'
                      }`}
                    >
                      {formatDay(candidate, opened.timezone)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            {day && (
              <div className="mt-7">
                <h3 className="text-2xs text-fog-dim tracking-[0.25em] uppercase">
                  Uhrzeit
                </h3>
                <ul className="mt-3 flex flex-wrap gap-2">
                  {times.map((candidate) => (
                    <li key={candidate}>
                      <button
                        type="button"
                        onClick={() => setTime(candidate)}
                        aria-pressed={time === candidate}
                        className={`tnum rounded-lg border px-4 py-2.5 transition-colors ${
                          time === candidate
                            ? 'border-brass bg-brass/16 text-brass-bright'
                            : 'border-steel-600/70 bg-steel-900/60 hover:border-brass/50'
                        }`}
                      >
                        {candidate}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div className="mt-7">
              <label
                htmlFor="note"
                className="text-2xs text-fog-dim tracking-[0.25em] uppercase"
              >
                Nachricht (optional)
              </label>
              <textarea
                id="note"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                maxLength={500}
                rows={3}
                className="border-steel-600/70 bg-steel-900/60 text-parchment placeholder:text-fog-dim mt-3 w-full rounded-lg border px-4 py-3"
                placeholder="Freu mich!"
              />
            </div>

            <p className="text-signal-no mt-3 min-h-5 text-sm" role="alert">
              {error}
            </p>

            <div className="mt-2 flex items-center justify-between gap-4">
              <button
                type="button"
                onClick={() => setStage('kind')}
                className="text-fog hover:text-brass text-sm underline underline-offset-4"
              >
                ← Zurück
              </button>
              <button
                type="button"
                disabled={!day || !time || busy}
                onClick={() => submit(true)}
                className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-7 py-3.5 transition-all hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-40"
              >
                {busy ? 'Einen Moment…' : 'Abmachen'}
              </button>
            </div>
          </motion.section>
        )}

        {stage === 'ticket' && ticket && (
          <motion.section
            key="ticket"
            {...fade}
            className="flex w-full flex-col items-center"
          >
            <Ticket data={ticket} />

            <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
              <a
                href={`/api/v/${encodeURIComponent(slug)}/ticket.ics`}
                className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-6 py-3 transition-colors"
              >
                Im Kalender speichern
              </a>
              <button
                type="button"
                onClick={() => window.print()}
                className="border-steel-600 text-parchment hover:border-brass/60 rounded-lg border px-6 py-3 transition-colors"
              >
                Drucken
              </button>
            </div>
          </motion.section>
        )}

        {stage === 'declined' && (
          <motion.section key="declined" {...fade} className="max-w-md text-center">
            <h1 className="font-display text-brass text-2xl tracking-wide">Alles gut</h1>
            <p className="text-fog mt-4 leading-relaxed">
              Deine Antwort ist angekommen. Der Tresor bleibt jetzt zu — und das ist
              völlig in Ordnung.
            </p>
          </motion.section>
        )}
      </AnimatePresence>
    </Shell>
  )
}

function Shell({ children, flash }: { children: React.ReactNode; flash?: boolean }) {
  return (
    // Siehe vault-experience: `m-auto` zentriert, ohne bei hohem Inhalt
    // den oberen Rand abzuschneiden.
    <main className="flex flex-1 flex-col items-center px-5 py-14">
      <div className="my-auto flex w-full flex-col items-center">{children}</div>

      {/* Übernimmt das Licht aus der Öffnungsanimation und blendet ab — der
          Schnitt zwischen den beiden Bildschirmen bleibt dadurch unsichtbar. */}
      {flash && (
        <motion.div
          aria-hidden
          className="pointer-events-none fixed inset-0 z-50"
          style={{
            background:
              'radial-gradient(circle at 50% 44%, var(--color-brass-bright) 0%, var(--color-brass) 30%, var(--color-brass-shadow) 58%, var(--color-ink) 82%)',
          }}
          initial={{ opacity: 1 }}
          animate={{ opacity: 0 }}
          transition={{ duration: 1.15, ease: [0.4, 0, 0.2, 1] }}
        />
      )}
    </main>
  )
}

/**
 * Der persönliche Text steigt Wort für Wort aus dem Tresor auf: unscharf und
 * klein aus der Tiefe, dann scharf auf Augenhöhe. Zeilenumbrüche des Autors
 * bleiben erhalten, deshalb wird zuerst nach Zeilen und erst dann nach
 * Wörtern getrennt.
 */
function EmergingText({ text, emerge }: { text: string; emerge: boolean }) {
  if (!emerge) {
    return (
      <p className="text-parchment text-lg leading-[1.75] whitespace-pre-line">{text}</p>
    )
  }

  // Der Zähler läuft über alle Zeilen hinweg, damit die Wörter in der
  // Reihenfolge auftauchen, in der man sie liest.
  let word = 0
  const lines = text.split('\n').map((line) =>
    line.split(/(\s+)/).map((chunk) => ({
      chunk,
      order: chunk.trim() ? word++ : -1,
    })),
  )

  return (
    <p className="text-parchment text-lg leading-[1.75]">
      {lines.map((chunks, lineIndex) => (
        <span key={lineIndex} className="block min-h-[1.75em]">
          {chunks.map(({ chunk, order }, chunkIndex) =>
            order < 0 ? (
              <span key={chunkIndex}>{chunk}</span>
            ) : (
              <motion.span
                key={chunkIndex}
                className="inline-block"
                initial={{ opacity: 0, y: 26, scale: 0.82, filter: 'blur(12px)' }}
                animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
                transition={{
                  duration: 0.85,
                  // Gedeckelt, damit ein langer Brief nicht minutenlang
                  // aufsteigt.
                  delay: 0.5 + Math.min(order, 44) * 0.042,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                {chunk}
              </motion.span>
            ),
          )}
        </span>
      ))}
    </p>
  )
}

function StepHeading({ step, title }: { step: number; title: string }) {
  return (
    <header className="text-center">
      <p className="text-2xs text-brass-dim tracking-[0.4em] uppercase">
        Schritt {step} von 2
      </p>
      <h2 className="font-display text-parchment mt-2 text-2xl tracking-wide">{title}</h2>
    </header>
  )
}

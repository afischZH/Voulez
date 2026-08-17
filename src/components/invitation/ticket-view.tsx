'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { HoloTicket } from '@/components/invitation/holo-ticket'
import { Ticket, type TicketData } from '@/components/invitation/ticket'
import type { WalletFlags } from '@/lib/wallet/flags'

/**
 * Das fertige Ticket — direkt nach der Zusage und später unter seinem eigenen
 * Link. Beide Wege zeigen dieselbe Karte, deshalb steht sie hier und nicht im
 * Flow.
 *
 * `drop` gilt nur für den Moment der Zusage: dort fällt die Karte aus der
 * Tiefe auf den Tisch. Beim späteren Aufrufen wäre dieselbe Geste eine
 * Behauptung — da ist nichts passiert, das Ticket liegt einfach da.
 */
export function TicketView({
  data,
  token,
  url,
  wallet = { apple: false, google: false },
  drop = false,
  children,
}: {
  data: TicketData
  /** Für den Kalendereintrag, der am selben Link hängt. */
  token: string
  /** Absolut, damit der Besuch ihn irgendwohin kopieren kann. */
  url: string
  /** Aus `walletFlags()`. Ohne Zertifikate erscheint kein Wallet-Knopf. */
  wallet?: WalletFlags
  drop?: boolean
  /** Was unter den Knöpfen steht — im Flow der Mailversand. */
  children?: React.ReactNode
}) {
  const still = useReducedMotion()
  const falling = drop && !still

  return (
    <div className="flex w-full flex-col items-center">
      <motion.div
        style={falling ? { transformPerspective: 1100 } : undefined}
        initial={
          falling
            ? { opacity: 0, scale: 0.72, y: -40, rotateX: -35, filter: 'blur(10px)' }
            : { opacity: 0 }
        }
        animate={{ opacity: 1, scale: 1, y: 0, rotateX: 0, filter: 'blur(0px)' }}
        transition={{ duration: falling ? 1.1 : 0.3, ease: [0.16, 1, 0.3, 1] }}
      >
        <HoloTicket data={data} />
      </motion.div>

      {data.message && (
        <p className="border-brass/50 text-fog mt-8 max-w-md border-l-2 pl-4 text-sm italic print:hidden">
          „{data.message}&ldquo;
        </p>
      )}

      {/* Auf Papier gehört ein lesbarer Pass hin, kein Hologramm. */}
      <div className="hidden print:block">
        <Ticket data={data} />
      </div>

      <div className="mt-8 flex flex-wrap justify-center gap-3 print:hidden">
        <a
          href={`/api/t/${encodeURIComponent(token)}/ticket.ics`}
          className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-6 py-3 transition-colors"
        >
          Im Kalender speichern
        </a>
        {/* Die Wallet-Knöpfe bleiben sekundär: der Kalendereintrag ist der
            eine Weg, den jedes Gerät versteht. Beide werden immer gezeigt —
            dieser Link existiert gerade dafür, dass die Karte auch auf einem
            fremden Gerät aufgeht, und ein Blick auf die Kennung des Browsers
            läge dort regelmässig daneben. */}
        {wallet.apple && (
          <a
            href={`/api/t/${encodeURIComponent(token)}/wallet/apple`}
            className="border-steel-600 text-parchment hover:border-brass/60 rounded-lg border px-6 py-3 transition-colors"
          >
            Zu Apple Wallet
          </a>
        )}
        {wallet.google && (
          <a
            href={`/api/t/${encodeURIComponent(token)}/wallet/google`}
            className="border-steel-600 text-parchment hover:border-brass/60 rounded-lg border px-6 py-3 transition-colors"
          >
            Zu Google Wallet
          </a>
        )}
        <button
          type="button"
          onClick={() => window.print()}
          className="border-steel-600 text-parchment hover:border-brass/60 rounded-lg border px-6 py-3 transition-colors"
        >
          Drucken
        </button>
      </div>

      {/* Der Google-Pass verlässt als einziger Weg von hier das Haus. Wer ihn
          speichert, soll vorher wissen, was mitgeht — nicht erst im
          Datenschutz nachlesen müssen. */}
      {wallet.google && (
        <p className="text-2xs text-fog-dim mt-3 max-w-md text-center print:hidden">
          Google Wallet erhält Vorname, Anlass, Termin und den Ticket-Link — nicht deine
          Nachricht. Mehr im{' '}
          <a href="/datenschutz" className="underline underline-offset-2">
            Datenschutz
          </a>
          .
        </p>
      )}

      <TicketLink url={url} />

      {children}
    </div>
  )
}

/**
 * Der Link zum Ticket. Er steht sichtbar da, statt nur in der Adresszeile:
 * genau hier — Karte auf dem Bildschirm, Tab noch offen — ist der eine
 * Moment, in dem jemand ihn sich sichert.
 */
function TicketLink({ url }: { url: string }) {
  const [copied, setCopied] = useState(false)

  // Die Bestätigung ist ein Zustand, kein Ereignis: ohne Rücksetzer bliebe
  // „Kopiert" für immer stehen.
  useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 2400)
    return () => clearTimeout(timer)
  }, [copied])

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // Ohne Zwischenablage-Recht (älteres Safari, kein HTTPS) bleibt der
      // Link lesbar auf dem Schirm — von Hand markieren geht immer.
      setCopied(false)
    }
  }

  return (
    <div className="border-steel-600/70 mt-8 w-full max-w-md rounded-xl border p-5 print:hidden">
      <p className="text-2xs text-fog-dim tracking-[0.25em] uppercase">
        Dein Ticket bleibt hier
      </p>
      <p className="text-fog mt-2 text-sm">
        Dieser Link zeigt die Karte jederzeit wieder — auf jedem Gerät, ohne PIN.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          readOnly
          value={url}
          aria-label="Link zum Ticket"
          onFocus={(event) => event.currentTarget.select()}
          className="border-steel-600/70 bg-steel-900/60 text-parchment min-w-0 flex-1 rounded-lg border px-4 py-2.5 font-mono text-xs"
        />
        <button
          type="button"
          onClick={copy}
          className="border-brass/70 text-brass-bright hover:bg-brass/16 rounded-lg border px-5 py-2.5 transition-colors"
        >
          {copied ? 'Kopiert' : 'Kopieren'}
        </button>
      </div>
    </div>
  )
}

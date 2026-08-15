'use client'

import { formatDateTime } from '@/lib/time'

export type TicketData = {
  slug: string
  optionLabel: string
  startsAt: string
  durationMin: number
  message: string | null
  recipientName: string
  hostName: string | null
  timezone: string
}

/**
 * Das Ticket macht die Verabredung greifbar. Es ist bewusst als Boarding Pass
 * gebaut: ein Format, das jeder sofort als "gilt wirklich" liest.
 */
export function Ticket({ data }: { data: TicketData }) {
  const when = formatDateTime(data.startsAt, data.timezone)
  const [weekday, ...rest] = when.split(', ')

  return (
    <div className="w-full max-w-2xl print:max-w-none">
      <div className="brushed border-brass/40 grid overflow-hidden rounded-2xl border sm:grid-cols-[1fr_auto] print:border-black print:bg-white print:text-black">
        {/* Hauptteil */}
        <div className="p-7 sm:p-9">
          <p className="text-2xs text-brass-dim tracking-[0.4em] uppercase print:text-black">
            Voulez · Einladung
          </p>

          <h1 className="font-display text-brass mt-4 text-3xl leading-tight tracking-wide print:text-black">
            {data.optionLabel}
          </h1>

          <dl className="mt-7 grid grid-cols-2 gap-x-6 gap-y-5 text-sm">
            <Field label="Tag">{weekday}</Field>
            <Field label="Datum & Zeit">{rest.join(', ')}</Field>
            <Field label="Für">{data.recipientName}</Field>
            <Field label="Mit">{data.hostName ?? '—'}</Field>
            <Field label="Dauer">ca. {Math.round(data.durationMin / 60)} h</Field>
            <Field label="Status">Bestätigt</Field>
          </dl>

          {data.message && (
            <p className="border-brass/50 text-fog mt-7 border-l-2 pl-4 text-sm italic print:text-black">
              „{data.message}&ldquo;
            </p>
          )}
        </div>

        {/* Perforation + Abriss */}
        <div className="border-brass/40 relative flex items-center justify-center border-t border-dashed px-7 py-6 sm:border-t-0 sm:border-l sm:px-8 print:border-black">
          <span
            aria-hidden
            className="bg-ink absolute -top-2.5 -left-2.5 hidden h-5 w-5 rounded-full sm:block print:bg-white"
          />
          <span
            aria-hidden
            className="bg-ink absolute -bottom-2.5 -left-2.5 hidden h-5 w-5 rounded-full sm:block print:bg-white"
          />

          <div className="flex items-center gap-3 sm:flex-col">
            <div aria-hidden className="flex h-14 gap-[3px]">
              {BARCODE.map((weight, i) => (
                <span
                  key={i}
                  className="bg-brass/70 h-full shrink-0 print:bg-black"
                  style={{ width: `${weight}px` }}
                />
              ))}
            </div>
            <p className="text-2xs text-fog-dim font-mono tracking-[0.25em] uppercase print:text-black">
              {data.slug}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-2xs text-fog-dim tracking-[0.2em] uppercase print:text-black">
        {label}
      </dt>
      <dd className="text-parchment mt-1 print:text-black">{children}</dd>
    </div>
  )
}

// Feste Strichfolge — ein zufälliges Muster würde bei jedem Rendern springen.
const BARCODE = [3, 1, 2, 4, 1, 3, 1, 2, 5, 1, 2, 3]

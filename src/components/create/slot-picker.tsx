'use client'

import { useState } from 'react'
import { formatDay } from '@/lib/time'

type Slot = { day: string; from: string; to: string }

/**
 * Zeitfenster statt fixer Termine: der Ersteller gibt vor, wann es ihm passt,
 * der Besuch wählt darin die genaue Uhrzeit. Das nimmt beiden Seiten den
 * Terminfindungs-Pingpong ab.
 */
export function SlotPicker({
  slots,
  timezone,
  onChange,
}: {
  slots: Slot[]
  timezone: string
  onChange: (slots: Slot[]) => void
}) {
  const [day, setDay] = useState('')
  const [from, setFrom] = useState('18:00')
  const [to, setTo] = useState('21:00')
  const [error, setError] = useState<string | null>(null)

  function add() {
    if (!day) return setError('Ein Datum fehlt.')
    // Heute ist als Fenster sinnlos — der Link muss erst noch ankommen. Die
    // Prüfung steht hier und nicht im Render, weil die aktuelle Zeit sonst
    // vom Zeitpunkt des Neuzeichnens abhinge.
    const earliest = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10)
    if (day < earliest) return setError('Bitte einen Tag ab morgen.')
    if (to <= from) return setError('Das Ende muss nach dem Anfang liegen.')
    if (slots.some((s) => s.day === day && s.from === from))
      return setError('Dieses Fenster gibt es schon.')

    setError(null)
    onChange(
      [...slots, { day, from, to }].sort((a, b) =>
        a.day === b.day ? a.from.localeCompare(b.from) : a.day.localeCompare(b.day),
      ),
    )
  }

  return (
    <div className="space-y-5">
      {slots.length > 0 && (
        <ul className="space-y-2">
          {slots.map((slot) => (
            <li
              key={`${slot.day}-${slot.from}`}
              className="border-steel-600/70 flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
            >
              <span className="min-w-0">
                <span className="text-parchment block truncate">
                  {formatDay(slot.day, timezone)}
                </span>
                <span className="tnum text-fog block text-sm">
                  {slot.from} – {slot.to}
                </span>
              </span>
              <button
                type="button"
                onClick={() => onChange(slots.filter((s) => s !== slot))}
                aria-label={`${formatDay(slot.day, timezone)} entfernen`}
                className="text-fog-dim hover:text-signal-no -mr-2 flex h-11 w-11 shrink-0 items-center justify-center transition-colors"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-steel-700 rounded-xl border border-dashed p-4">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
          <label className="block">
            <span className="text-2xs text-fog-dim tracking-[0.22em] uppercase">Tag</span>
            <input
              type="date"
              value={day}
              onChange={(e) => setDay(e.target.value)}
              className="border-steel-600/70 bg-steel-900/60 text-parchment mt-2 w-full rounded-lg border px-4 py-2.5"
            />
          </label>
          <label className="block">
            <span className="text-2xs text-fog-dim tracking-[0.22em] uppercase">Von</span>
            <input
              type="time"
              step={1800}
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border-steel-600/70 bg-steel-900/60 text-parchment tnum mt-2 w-full rounded-lg border px-4 py-2.5"
            />
          </label>
          <label className="block">
            <span className="text-2xs text-fog-dim tracking-[0.22em] uppercase">Bis</span>
            <input
              type="time"
              step={1800}
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border-steel-600/70 bg-steel-900/60 text-parchment tnum mt-2 w-full rounded-lg border px-4 py-2.5"
            />
          </label>
        </div>

        <p className="text-signal-no mt-3 min-h-5 text-sm" role="alert">
          {error}
        </p>

        <button
          type="button"
          onClick={add}
          disabled={slots.length >= 14}
          className="border-steel-600 text-parchment hover:border-brass/60 rounded-lg border px-5 py-2.5 text-sm transition-colors disabled:opacity-40"
        >
          Fenster hinzufügen
        </button>
      </div>

      <p className="text-fog-dim text-sm">
        Innerhalb eines Fensters kann dein Besuch in Halbstunden-Schritten wählen.
      </p>
    </div>
  )
}

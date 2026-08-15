'use client'

import { useState } from 'react'
import { TextArea, TextInput } from '@/components/create/fields'

export function ReportForm({ defaultSlug }: { defaultSlug: string }) {
  const [slug, setSlug] = useState(defaultSlug)
  const [reason, setReason] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  async function submit(event: React.FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError(null)

    const res = await fetch('/api/report', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slug: slug.trim(), reason: reason.trim(), contact }),
    })
    setBusy(false)

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      return setError(json.message ?? 'Das hat nicht geklappt.')
    }
    setDone(true)
  }

  if (done) {
    return (
      <p className="border-brass/40 bg-brass/8 text-parchment rounded-xl border px-5 py-4">
        Die Meldung ist angekommen. Danke — wir schauen sie an.
      </p>
    )
  }

  return (
    <form onSubmit={submit} className="border-steel-700 space-y-5 rounded-xl border p-5">
      <TextInput
        label="Link oder Kennung des Tresors"
        hint="Der Teil nach /v/ — zum Beispiel 9kp7x8jm."
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder="9kp7x8jm"
        maxLength={120}
        required
      />
      <TextArea
        label="Was ist das Problem?"
        rows={5}
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        maxLength={2000}
        required
      />
      <TextInput
        label="Deine E-Mail (optional)"
        hint="Nur, falls wir nachfragen müssen."
        type="email"
        value={contact}
        onChange={(e) => setContact(e.target.value)}
      />

      <p className="text-signal-no min-h-5 text-sm" role="alert">
        {error}
      </p>

      <button
        type="submit"
        disabled={busy || !slug.trim() || reason.trim().length < 10}
        className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-6 py-3 transition-colors disabled:opacity-40"
      >
        {busy ? 'Einen Moment…' : 'Meldung abschicken'}
      </button>
    </form>
  )
}

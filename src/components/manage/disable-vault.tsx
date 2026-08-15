'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

/** Deaktivieren ist die einzige zerstörende Aktion — deshalb mit Rückfrage. */
export function DisableVault({ token }: { token: string }) {
  const router = useRouter()
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function disable() {
    setBusy(true)
    setError(null)
    const res = await fetch('/api/vaults/disable', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    setBusy(false)
    if (!res.ok) return setError('Das hat nicht geklappt.')
    router.refresh()
  }

  if (!asking) {
    return (
      <button
        type="button"
        onClick={() => setAsking(true)}
        className="text-fog hover:text-signal-no text-sm underline underline-offset-4 transition-colors"
      >
        Tresor deaktivieren
      </button>
    )
  }

  return (
    <div className="border-signal-no/40 rounded-xl border p-5">
      <p className="text-parchment">
        Danach führt der Link ins Leere. Das lässt sich nicht rückgängig machen.
      </p>
      <p className="text-signal-no mt-2 min-h-5 text-sm" role="alert">
        {error}
      </p>
      <div className="mt-3 flex gap-3">
        <button
          type="button"
          onClick={() => void disable()}
          disabled={busy}
          className="border-signal-no/60 text-signal-no hover:bg-signal-no/10 rounded-lg border px-5 py-2.5 text-sm transition-colors disabled:opacity-50"
        >
          {busy ? 'Einen Moment…' : 'Ja, deaktivieren'}
        </button>
        <button
          type="button"
          onClick={() => setAsking(false)}
          className="text-fog hover:text-parchment px-2 text-sm"
        >
          Abbrechen
        </button>
      </div>
    </div>
  )
}

'use client'

import { useState } from 'react'

type State =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent'; email: string }
  | { kind: 'error'; message: string }

const EMAIL = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Die Bestätigung zum Mitnehmen. Das Ticket steht auf dem Bildschirm, aber
 * ein Tab schliesst sich schneller als man denkt — und anders als der
 * Ersteller hat der Besucher keine Adresse hinterlegt, an die man von selbst
 * etwas schicken könnte. Also: freiwillig, hier, nach der Zusage.
 */
export function TicketMailer({ slug, token }: { slug: string; token: string }) {
  const [email, setEmail] = useState('')
  const [state, setState] = useState<State>({ kind: 'idle' })

  async function submit(event: React.FormEvent) {
    event.preventDefault()

    const address = email.trim()
    if (!EMAIL.test(address)) {
      return setState({
        kind: 'error',
        message: 'Diese Adresse sieht nicht richtig aus.',
      })
    }

    setState({ kind: 'sending' })

    const res = await fetch(`/api/v/${encodeURIComponent(slug)}/ticket/email`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      // Der Token kommt mit, damit der Link zum Ticket in der Mail stehen
      // kann: gespeichert ist serverseitig nur sein Hash.
      body: JSON.stringify({ email: address, token }),
    })
    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      return setState({
        kind: 'error',
        message: json.message ?? 'Das hat nicht geklappt. Nochmal versuchen?',
      })
    }
    setState({ kind: 'sent', email: address })
  }

  if (state.kind === 'sent') {
    return (
      <div className="border-brass/30 bg-brass/6 mt-8 w-full max-w-md rounded-xl border p-5 text-center print:hidden">
        <p className="text-parchment">
          Unterwegs an <strong className="text-brass-bright">{state.email}</strong>.
        </p>
        <p className="text-fog-dim mt-2 text-sm">
          Mit dem Link zum Ticket und dem Termin als Kalenderdatei.
        </p>
        <button
          type="button"
          onClick={() => {
            setEmail('')
            setState({ kind: 'idle' })
          }}
          className="text-fog hover:text-brass mt-4 text-sm underline underline-offset-4"
        >
          An eine andere Adresse schicken
        </button>
      </div>
    )
  }

  return (
    <form
      onSubmit={submit}
      className="border-steel-600/70 mt-8 w-full max-w-md rounded-xl border p-5 print:hidden"
    >
      <label
        htmlFor="ticket-email"
        className="text-2xs text-fog-dim tracking-[0.25em] uppercase"
      >
        Bestätigung per E-Mail (optional)
      </label>
      <p className="text-fog mt-2 text-sm">
        Wir schicken dir diese Daten samt Kalendereintrag. Die Adresse wird nicht
        gespeichert und nicht weitergegeben.
      </p>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <input
          id="ticket-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value)
            if (state.kind === 'error') setState({ kind: 'idle' })
          }}
          placeholder="du@beispiel.ch"
          maxLength={200}
          className="border-steel-600/70 bg-steel-900/60 text-parchment placeholder:text-fog-dim min-w-0 flex-1 rounded-lg border px-4 py-2.5"
        />
        <button
          type="submit"
          disabled={state.kind === 'sending'}
          className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-5 py-2.5 transition-colors disabled:opacity-40"
        >
          {state.kind === 'sending' ? 'Einen Moment…' : 'Schicken'}
        </button>
      </div>

      <p className="text-signal-no mt-2 min-h-5 text-sm" role="alert">
        {state.kind === 'error' ? state.message : ''}
      </p>
    </form>
  )
}

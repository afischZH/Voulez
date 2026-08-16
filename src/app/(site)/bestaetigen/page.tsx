import Link from 'next/link'
import type { Metadata } from 'next'
import { hashToken } from '@/lib/crypto'
import { env } from '@/lib/env'
import { db } from '@/lib/supabase/server'
import { formatDay } from '@/lib/time'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Bestätigung',
  robots: { index: false, follow: false },
}

/**
 * Der Doppel-Opt-In. Bis hierher war der Tresor nur ein Entwurf — erst dieser
 * Klick beweist, dass die E-Mail-Adresse dem Ersteller gehört.
 */
export default async function ConfirmPage({ searchParams }: PageProps<'/bestaetigen'>) {
  const { token } = await searchParams
  const value = Array.isArray(token) ? token[0] : token

  if (!value) return <Message title="Kein Link" body="Dieser Link ist unvollständig." />

  const { data: vault } = await db()
    .from('vaults')
    .select('id, slug, status, recipient_name, creator_name, creator_email, timezone')
    .eq('confirm_token_hash', hashToken(value))
    .maybeSingle()

  if (!vault) {
    return (
      <Message
        title="Link ungültig"
        body="Dieser Bestätigungslink gehört zu keinem Tresor. Vielleicht wurde er schon benutzt und ersetzt."
      />
    )
  }

  if (vault.status === 'draft') {
    await db()
      .from('vaults')
      .update({
        status: 'live',
        confirmed_at: new Date().toISOString(),
        // Der Bestätigungslink ist verbraucht.
        confirm_token_hash: null,
      })
      .eq('id', vault.id)
  }

  const shareUrl = `${env.siteUrl}/v/${vault.slug}`

  // Was der Tresor enthält, steht ab jetzt nur noch in der Datenbank: der
  // Entwurf im Browser ist beim Abschicken gelöscht worden.
  const [{ data: options }, { data: slots }] = await Promise.all([
    db().from('date_options').select('label').eq('vault_id', vault.id).order('position'),
    db()
      .from('date_slots')
      .select('day,time_from,time_to')
      .eq('vault_id', vault.id)
      .order('day')
      .order('time_from'),
  ])

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20">
      <div className="my-auto w-full max-w-lg text-center">
        <p className="text-2xs text-brass-dim tracking-[0.4em] uppercase">Bestätigt</p>
        <h1 className="font-display text-parchment mt-4 text-3xl tracking-wide">
          Der Tresor steht
        </h1>
        <p className="text-fog mt-4">
          Schick {vault.recipient_name} diesen Link. Mehr braucht es nicht.
        </p>

        <div className="border-brass/40 bg-brass/8 mt-8 rounded-xl border p-5">
          <p className="text-2xs text-fog-dim tracking-[0.25em] uppercase">
            Link zum Teilen
          </p>
          <p className="text-brass-bright mt-2 font-mono text-sm break-all">{shareUrl}</p>
        </div>

        <dl className="border-steel-700 mt-8 space-y-4 border-t pt-8 text-left">
          <Row label="Für">{vault.recipient_name}</Row>
          <Row label="Von">{vault.creator_name ?? vault.creator_email}</Row>
          <Row label="Zur Auswahl">
            {(options ?? []).map((o) => o.label).join(' · ') || '—'}
          </Row>
          <Row label="Zeitfenster">
            {(slots ?? []).map((s) => (
              <span key={`${s.day}${s.time_from}`} className="block">
                {formatDay(s.day, vault.timezone)}, {s.time_from.slice(0, 5)}–
                {s.time_to.slice(0, 5)}
              </span>
            ))}
            <span className="text-fog-dim mt-1 block text-sm">{vault.timezone}</span>
          </Row>
          <Row label="Antwort an">{vault.creator_email}</Row>
        </dl>

        <p className="text-fog-dim mt-6 text-sm">
          Den Verwaltungslink findest du in derselben E-Mail. Heb sie auf — er lässt sich
          nicht wiederherstellen.
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link
            href={`/v/${vault.slug}`}
            className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-6 py-3 transition-colors"
          >
            Tresor ansehen
          </Link>
        </div>
      </div>
    </main>
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

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20">
      <div className="my-auto max-w-md text-center">
        <h1 className="font-display text-brass text-2xl tracking-wide">{title}</h1>
        <p className="text-fog mt-3">{body}</p>
        <Link
          href="/"
          className="text-fog hover:text-brass mt-8 inline-block text-sm underline underline-offset-4"
        >
          Zur Startseite
        </Link>
      </div>
    </main>
  )
}

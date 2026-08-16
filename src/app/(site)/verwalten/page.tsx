import Link from 'next/link'
import type { Metadata } from 'next'
import { hashToken } from '@/lib/crypto'
import { env } from '@/lib/env'
import { db } from '@/lib/supabase/server'
import { formatDateTime } from '@/lib/time'
import { DisableVault } from '@/components/manage/disable-vault'

export const dynamic = 'force-dynamic'

// Die URL trägt den Verwaltungstoken — sie darf nirgends auftauchen.
export const metadata: Metadata = {
  title: 'Verwaltung',
  robots: { index: false, follow: false },
}

const STATUS_LABEL: Record<string, string> = {
  draft: 'Wartet auf deine Bestätigung',
  live: 'Offen — wartet auf Besuch',
  answered: 'Beantwortet',
  declined: 'Beantwortet',
  expired: 'Abgelaufen',
  disabled: 'Von dir deaktiviert',
}

/**
 * Die Verwaltungsseite. Ohne Login ist der Token in der URL der einzige
 * Nachweis — deshalb steht hier nichts, was nicht ohnehin der Ersteller weiss.
 */
export default async function ManagePage({ searchParams }: PageProps<'/verwalten'>) {
  const { token } = await searchParams
  const value = Array.isArray(token) ? token[0] : token
  if (!value) return <Message title="Kein Link" body="Dieser Link ist unvollständig." />

  const { data: vault } = await db()
    .from('vaults')
    .select('*')
    .eq('edit_token_hash', hashToken(value))
    .maybeSingle()

  if (!vault) {
    return (
      <Message
        title="Link ungültig"
        body="Zu diesem Verwaltungslink gibt es keinen Tresor."
      />
    )
  }

  const [{ data: response }, { data: events }] = await Promise.all([
    db()
      .from('responses')
      .select('accepted, starts_at, message, option_id')
      .eq('vault_id', vault.id)
      .maybeSingle(),
    db()
      .from('vault_events')
      .select('kind, created_at')
      .eq('vault_id', vault.id)
      .order('created_at', { ascending: false })
      .limit(1),
  ])

  const option = response?.option_id
    ? await db()
        .from('date_options')
        .select('label')
        .eq('id', response.option_id)
        .maybeSingle()
    : null

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="my-auto w-full max-w-lg">
        <p className="text-2xs text-brass-dim tracking-[0.4em] uppercase">Verwaltung</p>
        <h1 className="font-display text-parchment mt-3 text-3xl tracking-wide">
          Tresor für {vault.recipient_name}
        </h1>
        <p className="text-fog mt-3">{STATUS_LABEL[vault.status] ?? vault.status}</p>

        {response && (
          <div className="border-brass/40 bg-brass/8 mt-8 rounded-xl border p-5">
            <p className="text-2xs text-brass-dim tracking-[0.25em] uppercase">
              Die Antwort
            </p>
            {response.accepted ? (
              <>
                <p className="text-parchment mt-3 text-lg">
                  {option?.data?.label ?? 'Zusage'}
                </p>
                <p className="text-fog mt-1">
                  {response.starts_at
                    ? formatDateTime(response.starts_at, vault.timezone)
                    : ''}
                </p>
              </>
            ) : (
              <p className="text-parchment mt-3">
                Passt gerade nicht. Kein Termin vereinbart.
              </p>
            )}
            {response.message && (
              <p className="border-brass/50 text-fog mt-4 border-l-2 pl-4 italic">
                „{response.message}&ldquo;
              </p>
            )}
          </div>
        )}

        {vault.status === 'live' && (
          <div className="border-steel-600/70 mt-6 rounded-xl border p-5">
            <p className="text-2xs text-fog-dim tracking-[0.25em] uppercase">
              Link zum Teilen
            </p>
            <p className="text-brass-bright mt-2 font-mono text-sm break-all">
              {env.siteUrl}/v/{vault.slug}
            </p>
            <p className="text-fog-dim mt-4 text-sm">
              {events?.length
                ? `Letzte Aktivität: ${formatDateTime(events[0].created_at, vault.timezone)}`
                : 'Noch niemand war da.'}
            </p>
            {vault.recipient_email && (
              <p className="text-fog-dim mt-2 text-sm">
                {vault.invitation_sent_at
                  ? `Einladung an ${vault.recipient_email} verschickt am ${formatDateTime(vault.invitation_sent_at, vault.timezone)}.`
                  : `Die Einladung an ${vault.recipient_email} liess sich nicht zustellen — gib den Link selbst weiter.`}
              </p>
            )}
          </div>
        )}

        <p className="text-fog-dim mt-6 text-sm">
          Läuft ab am {formatDateTime(vault.expires_at, vault.timezone)}.
        </p>

        {vault.status !== 'disabled' && (
          <div className="mt-10">
            <DisableVault token={value} />
          </div>
        )}

        <p className="text-fog-dim mt-10 text-sm">
          Inhalte lassen sich nachträglich nicht ändern. Wenn etwas nicht stimmt,
          deaktiviere den Tresor und{' '}
          <Link href="/erstellen" className="text-fog underline underline-offset-4">
            bau einen neuen
          </Link>
          .
        </p>
      </div>
    </main>
  )
}

function Message({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20">
      <div className="my-auto max-w-md text-center">
        <h1 className="font-display text-brass text-2xl tracking-wide">{title}</h1>
        <p className="text-fog mt-3">{body}</p>
      </div>
    </main>
  )
}

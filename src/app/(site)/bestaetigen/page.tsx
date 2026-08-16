import Link from 'next/link'
import type { Metadata } from 'next'
import { hashToken } from '@/lib/crypto'
import { env } from '@/lib/env'
import { invitationMail } from '@/lib/invitation-mail'
import { send } from '@/lib/mail'
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
    .select(
      'id, slug, status, recipient_name, recipient_email, intro_text, creator_name, creator_email, timezone',
    )
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

  // Jetzt — und keinen Moment früher — darf die Einladung raus: erst dieser
  // Klick beweist, dass hinter dem Absender jemand steht, der die Adresse des
  // Empfängers freiwillig eingetragen hat.
  const invitation = vault.recipient_email
    ? await sendInvitation({ ...vault, recipient_email: vault.recipient_email }, shareUrl)
    : null

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
          {invitation === 'sent' || invitation === 'already'
            ? `Die Einladung ist unterwegs zu ${vault.recipient_name}. Mehr braucht es nicht.`
            : `Schick ${vault.recipient_name} diesen Link. Mehr braucht es nicht.`}
        </p>

        {invitation === 'sent' || invitation === 'already' ? (
          <div className="border-brass/40 bg-brass/8 mt-8 rounded-xl border p-5 text-left">
            <p className="text-2xs text-brass-dim tracking-[0.25em] uppercase">
              Einladung verschickt
            </p>
            <p className="text-parchment mt-2">{vault.recipient_email}</p>
            <p className="text-fog-dim mt-3 text-sm">
              Mit deinem ersten Satz, deinem Namen und dem Link zum Tresor. Der Link steht
              unten — falls du ihn zusätzlich selbst weitergeben willst.
            </p>
          </div>
        ) : (
          invitation === 'failed' && (
            <div className="border-signal-no/50 bg-signal-no/8 mt-8 rounded-xl border p-5 text-left">
              <p className="text-2xs text-signal-no tracking-[0.25em] uppercase">
                Einladung nicht zustellbar
              </p>
              <p className="text-parchment mt-2">{vault.recipient_email}</p>
              <p className="text-fog-dim mt-3 text-sm">
                Der Tresor steht trotzdem. Schick den Link unten am besten selbst.
              </p>
            </div>
          )
        )}

        <div className="border-brass/40 bg-brass/8 mt-6 rounded-xl border p-5">
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

type InvitationTarget = {
  id: string
  recipient_name: string
  recipient_email: string
  intro_text: string | null
  creator_name: string | null
}

/**
 * Die gestaltete Einladung an den Empfänger. Sie geht genau einmal raus.
 *
 * Der Anspruch wird vor dem Versand eingetragen und nicht danach: E-Mail-Links
 * werden von Vorschau-Diensten und Sicherheitsscannern besucht, gelegentlich
 * gleichzeitig mit dem Menschen. Beide Aufrufe fänden ein leeres Feld vor und
 * die Einladung ginge doppelt raus. Wer die Zeile nicht gesetzt bekommt, hat
 * verloren und schickt nichts.
 */
async function sendInvitation(
  vault: InvitationTarget,
  shareUrl: string,
): Promise<'sent' | 'failed' | 'already'> {
  const { data: claimed } = await db()
    .from('vaults')
    .update({ invitation_sent_at: new Date().toISOString() })
    .eq('id', vault.id)
    .is('invitation_sent_at', null)
    .select('id')
    .maybeSingle()

  if (!claimed) return 'already'

  const mail = invitationMail({
    recipientName: vault.recipient_name,
    senderName: vault.creator_name,
    introText: vault.intro_text,
    url: shareUrl,
    reportUrl: `${env.siteUrl}/melden`,
  })

  const result = await send({
    to: vault.recipient_email,
    ...mail,
    // Die Adresse steht schon in unserer Datenbank und wird dort mit dem
    // Tresor gelöscht. Eine zweite Ablage beim Versanddienst hätte kein
    // eigenes Ende — also den Kontakt gleich wieder wegräumen.
    forget: true,
  })

  if (!result.ok) {
    console.error('Einladung nicht zustellbar', result)
    // Der Eintrag oben war eine Wette auf den Versand. Sie ging verloren, also
    // zurücknehmen: das Feld soll nur behaupten, was wirklich passiert ist.
    await db().from('vaults').update({ invitation_sent_at: null }).eq('id', vault.id)
    return 'failed'
  }

  // Ohne `logEvent`: das ist bewusst fire-and-forget, und eine Server-Komponente
  // ist nach dem Rendern fertig — der Einschub käme womöglich nie an.
  await db()
    .from('vault_events')
    .insert({ vault_id: vault.id, kind: 'invitation_mailed' })

  return 'sent'
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

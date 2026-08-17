import { z } from 'zod'
import { hashToken } from '@/lib/crypto'
import { errors, fail, ok } from '@/lib/http'
import { buildIcs, googleCalendarUrl } from '@/lib/ics'
import { send } from '@/lib/mail'
import { allow, clientFingerprint, LIMITS } from '@/lib/rate-limit'
import { hasUnlocked } from '@/lib/session'
import { db } from '@/lib/supabase/server'
import { ticketUrl } from '@/lib/ticket'
import { formatDateTime, formatDuration } from '@/lib/time'
import { findVault, logEvent, playable } from '@/lib/vault'

const bodySchema = z.object({
  email: z.email().max(200),
  /** Der Ticket-Link, den der Besuch gerade vor sich hat. Optional: eine
   *  Zusage von vor dieser Änderung hat keinen. */
  token: z.string().max(64).optional(),
})

/**
 * Schickt dem Besucher seine eigene Bestätigung — dieselben Daten, die nach
 * dem Zusagen auf dem Ticket stehen, plus Kalendereintrag.
 *
 * Freiwillig und nachgelagert: die Adresse des Besuchers wird nirgends
 * gespeichert, sie wird nur für diesen einen Versand benutzt. Deshalb auch
 * das eigene, enge Limit — der Endpunkt darf kein Versandweg für Fremdes
 * werden, obwohl er hinter dem Öffnungs-Cookie liegt.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const permitted = await allow(
    `ticketmail:${slug}:${clientFingerprint(request)}`,
    LIMITS.ticketMail.limit,
    LIMITS.ticketMail.windowSeconds,
  )
  if (!permitted) return errors.tooMany(LIMITS.ticketMail.windowSeconds)

  const state = playable(await findVault(slug))
  if (!state.ok) {
    return state.reason === 'expired' ? errors.gone() : errors.notFound()
  }
  const vault = state.vault

  // Ohne Öffnungs-Nachweis kein Ticket: sonst liesse sich der Inhalt eines
  // fremden Tresors an eine beliebige Adresse schicken.
  if (!(await hasUnlocked(slug, vault.id))) {
    return errors.badRequest('Der Tresor ist nicht geöffnet.')
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) {
    return errors.badRequest('Diese E-Mail-Adresse sieht nicht richtig aus.')
  }

  const { data: response } = await db()
    .from('responses')
    .select(
      'id,accepted,starts_at,duration_min,created_at,option_id,custom_label,message,ticket_token_hash',
    )
    .eq('vault_id', vault.id)
    .maybeSingle()

  if (!response?.accepted || !response.starts_at) {
    return errors.badRequest('Zu diesem Tresor gibt es noch keine Zusage.')
  }

  const { data: option } = response.option_id
    ? await db()
        .from('date_options')
        .select('label,description')
        .eq('id', response.option_id)
        .maybeSingle()
    : { data: null }

  // Der eigene Vorschlag hat keine Option hinter sich — dann steht sein Text
  // an derselben Stelle.
  const what = option?.label ?? response.custom_label ?? 'Unternehmung'
  const host = vault.creator_name ?? 'deinem Gastgeber'

  // Nur wenn der mitgeschickte Token wirklich zu dieser Zusage gehört. Sonst
  // stünde in der Mail ein Link, der irgendwohin zeigt — geprüft wird gegen
  // den Hash, denn den Token selbst speichert Voulez nirgends.
  const link =
    body.data.token && response.ticket_token_hash === hashToken(body.data.token)
      ? ticketUrl(body.data.token)
      : null

  const event = {
    uid: `${response.id}@voulez`,
    start: new Date(response.starts_at),
    createdAt: new Date(response.created_at),
    durationMinutes: response.duration_min,
    title: `${what} mit ${vault.creator_name ?? vault.recipient_name}`,
    description: option?.description ?? undefined,
    // Bewusst ohne ORGANIZER: die Zieladresse tippt der Besucher frei ein,
    // und die Adresse des Erstellers gehört nicht ungefragt dorthin.
  }

  const mail = await send({
    to: body.data.email,
    subject: `Deine Verabredung: ${what}`,
    text: [
      `Deine Zusage ist angekommen. Hier stehen alle Daten noch einmal:`,
      '',
      `Was:   ${what}`,
      `Wann:  ${formatDateTime(response.starts_at, vault.timezone)} (${vault.timezone})`,
      `Dauer: ca. ${formatDuration(response.duration_min)}`,
      `Für:   ${vault.recipient_name}`,
      `Mit:   ${vault.creator_name ?? '—'}`,
      `Code:  ${slug}`,
      response.message ? `\nDeine Nachricht: „${response.message}"` : '',
      '',
      link ? `Dein Ticket bleibt hier: ${link}\n` : '',
      `Der Termin liegt als Kalenderdatei bei.`,
      `Ohne .ics-Anhang geht es auch hier: ${googleCalendarUrl(event)}`,
      '',
      `Diese Mail ging an dich, weil du sie dir nach dem Öffnen des Tresors`,
      `selbst geschickt hast. ${host} erfährt deine Adresse dadurch nicht.`,
    ].join('\n'),
    attachments: [
      {
        filename: 'voulez-termin.ics',
        content: Buffer.from(buildIcs(event), 'utf-8').toString('base64'),
        contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
      },
    ],
    // Die Zusage oben gilt auch für den Versanddienst: Plunk legt zu jeder
    // Empfängeradresse einen Kontakt an, dieser hier wird sofort wieder
    // gelöscht. Bleibt er stehen, steht es im Server-Log.
    forget: true,
  })

  if (!mail.ok) {
    console.error('Ticketmail nicht zustellbar', mail)
    return fail(
      502,
      'mail_failed',
      mail.reason === 'not_configured'
        ? 'Der E-Mail-Versand ist auf diesem Server nicht eingerichtet.'
        : 'Die E-Mail liess sich nicht zustellen. Prüf die Adresse und versuch es nochmal.',
    )
  }

  // Ohne Adresse: dass ein Ticket verschickt wurde, ist für den Ersteller
  // interessant — an wen, geht ihn nichts an.
  logEvent(vault.id, 'ticket_mailed')

  return ok({ sent: true })
}

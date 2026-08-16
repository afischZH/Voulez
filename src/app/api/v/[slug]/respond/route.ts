import { z } from 'zod'
import { db } from '@/lib/supabase/server'
import { errors, ok } from '@/lib/http'
import { buildIcs, googleCalendarUrl } from '@/lib/ics'
import { send } from '@/lib/mail'
import { allow, clientFingerprint, LIMITS } from '@/lib/rate-limit'
import { hasUnlocked } from '@/lib/session'
import { formatDateTime, slotTimes, zonedToUtc } from '@/lib/time'
import { findVault, logEvent, playable } from '@/lib/vault'

const bodySchema = z.discriminatedUnion('accepted', [
  z.object({
    accepted: z.literal(true),
    /** Entweder eine der angebotenen Möglichkeiten … */
    optionId: z.uuid().optional(),
    /** … oder ein eigener Vorschlag. Nur eines von beidem, und `customLabel`
     *  nur, wenn der Ersteller es zugelassen hat — geprüft wird das unten am
     *  Tresor, nicht hier im Schema. */
    customLabel: z.string().trim().min(1).max(60).optional(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    durationMin: z.number().int().min(30).max(600).default(120),
    message: z.string().max(500).optional(),
  }),
  z.object({
    accepted: z.literal(false),
    message: z.string().max(500).optional(),
  }),
])

/** Wie weit in die Zukunft ein frei gewählter Termin liegen darf. */
const MAX_DAYS_AHEAD = 365

/**
 * `2026-02-31` besteht die Regex, ist aber kein Datum — `zonedToUtc` würde
 * daraus stillschweigend den 3. März machen und ein Ticket mit falschem Tag
 * ausstellen.
 */
function realDay(day: string): boolean {
  const [year, month, date] = day.split('-').map(Number)
  const probe = new Date(Date.UTC(year, month - 1, date))
  return (
    probe.getUTCFullYear() === year &&
    probe.getUTCMonth() === month - 1 &&
    probe.getUTCDate() === date
  )
}

/**
 * Die Antwort des Besuchers. Erfordert den Nachweis, dass der Tresor
 * tatsächlich geöffnet wurde — sonst könnte man die PIN einfach überspringen
 * und direkt hier zusagen.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const permitted = await allow(
    `respond:${slug}:${clientFingerprint(request)}`,
    LIMITS.respond.limit,
    LIMITS.respond.windowSeconds,
  )
  if (!permitted) return errors.tooMany(LIMITS.respond.windowSeconds)

  const state = playable(await findVault(slug))
  if (!state.ok) {
    return state.reason === 'expired' ? errors.gone() : errors.notFound()
  }
  const vault = state.vault

  if (!(await hasUnlocked(slug, vault.id))) {
    return errors.badRequest('Der Tresor ist nicht geöffnet.')
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return errors.badRequest()

  // Eine bereits gegebene Antwort wird nicht stillschweigend überschrieben.
  const { data: existing } = await db()
    .from('responses')
    .select('id')
    .eq('vault_id', vault.id)
    .maybeSingle()
  if (existing) return errors.badRequest('Es gibt schon eine Antwort.')

  if (!body.data.accepted) {
    await db()
      .from('responses')
      .insert({
        vault_id: vault.id,
        accepted: false,
        message: body.data.message ?? null,
      })
    await db().from('vaults').update({ status: 'declined' }).eq('id', vault.id)
    logEvent(vault.id, 'answered', { accepted: false })

    await notifyDecline(vault.creator_email, vault.recipient_name, body.data.message)
    return ok({ saved: true, accepted: false })
  }

  const { optionId, customLabel, day, time, durationMin, message } = body.data

  // Genau eines von beidem. Beides zusammen wäre nicht entscheidbar, keines
  // von beidem liesse eine Zusage ohne Inhalt zurück.
  if (Boolean(optionId) === Boolean(customLabel)) {
    return errors.badRequest('Wähle entweder eine Möglichkeit oder schlage etwas vor.')
  }
  if (customLabel && !vault.allow_custom_proposal) {
    return errors.badRequest('Eigene Vorschläge sind hier nicht vorgesehen.')
  }

  let option: { id: string; label: string } | null = null
  if (optionId) {
    const { data } = await db()
      .from('date_options')
      .select('id,label')
      .eq('id', optionId)
      .eq('vault_id', vault.id)
      .maybeSingle()
    if (!data) return errors.badRequest('Diese Option gibt es nicht.')
    option = data
  }

  if (!realDay(day)) return errors.badRequest('Diesen Tag gibt es nicht.')

  // Der Zeitpunkt muss in einem der freigegebenen Fenster liegen. Der Client
  // bietet nur gültige an — verlassen kann man sich darauf nicht.
  const { data: slots } = await db()
    .from('date_slots')
    .select('day,time_from,time_to')
    .eq('vault_id', vault.id)
    .eq('day', day)

  const inSlot = (slots ?? []).some((slot) =>
    slotTimes(slot.time_from.slice(0, 5), slot.time_to.slice(0, 5)).includes(time),
  )
  // Ausserhalb der Fenster nur, wenn der Ersteller den freien Termin erlaubt
  // hat. Dann steht in seiner Mail ausdrücklich, dass er ihn nie angeboten hat.
  if (!inSlot && !vault.allow_custom_proposal) {
    return errors.badRequest('Dieser Zeitpunkt ist nicht freigegeben.')
  }
  const customTime = !inSlot

  const startsAt = zonedToUtc(day, time, vault.timezone)

  // Ein freier Termin ist der einzige Weg, an dem ein Datum in der
  // Vergangenheit oder in ferner Zukunft überhaupt hereinkommt.
  if (customTime) {
    const ahead = (startsAt.getTime() - Date.now()) / 86_400_000
    if (ahead < 0) return errors.badRequest('Dieser Zeitpunkt ist schon vorbei.')
    if (ahead > MAX_DAYS_AHEAD) return errors.badRequest('Das liegt zu weit weg.')
  }

  // `id` und `created_at` werden für den Kalendereintrag gebraucht: die UID
  // muss stabil sein, damit ein zweiter Download denselben Termin aktualisiert
  // statt einen weiteren anzulegen.
  const { data: response, error } = await db()
    .from('responses')
    .insert({
      vault_id: vault.id,
      accepted: true,
      option_id: option?.id ?? null,
      custom_label: customLabel ?? null,
      custom_time: customTime,
      starts_at: startsAt.toISOString(),
      duration_min: durationMin,
      message: message ?? null,
    })
    .select('id, created_at')
    .single()
  if (error || !response) {
    console.error('Antwort konnte nicht gespeichert werden', error)
    return errors.badRequest('Die Antwort konnte nicht gespeichert werden.')
  }

  const what = option?.label ?? customLabel!

  await db().from('vaults').update({ status: 'answered' }).eq('id', vault.id)
  logEvent(vault.id, 'answered', {
    accepted: true,
    optionId: option?.id ?? null,
    custom: Boolean(customLabel) || customTime,
  })

  // Mit `await`: die Serverless-Funktion darf nach der Antwort einfrieren, ein
  // nachgelagerter Versand käme dann nie an — und diese Mail ist der einzige
  // Weg, auf dem der Ersteller von der Zusage erfährt. Ein Fehlschlag wird
  // geloggt, darf aber die bereits gespeicherte Antwort nicht kippen.
  await notifyAccept({
    to: vault.creator_email,
    who: vault.recipient_name,
    what,
    when: formatDateTime(startsAt.toISOString(), vault.timezone),
    timezone: vault.timezone,
    ownIdea: Boolean(customLabel),
    ownTime: customTime,
    message: message ?? null,
    event: {
      uid: `${response.id}@voulez`,
      start: startsAt,
      createdAt: new Date(response.created_at),
      durationMinutes: durationMin,
      title: `${what} mit ${vault.recipient_name}`,
      description: message ?? undefined,
      organizerEmail: vault.creator_email,
    },
  })

  return ok({
    saved: true,
    accepted: true,
    ticket: {
      optionLabel: what,
      startsAt: startsAt.toISOString(),
      durationMin,
      message: message ?? null,
    },
  })
}

/**
 * Die Zusage-Mail an den Ersteller. Sie trägt den Termin als Anhang, statt
 * irgendwohin zu verlinken: der Ersteller hat kein Öffnungs-Cookie, kommt
 * also weder an `/api/v/[slug]/ticket.ics` noch an den Tresor selbst — der
 * gilt nach der Antwort als nicht mehr spielbar.
 */
async function notifyAccept(args: {
  to: string
  who: string
  what: string
  when: string
  timezone: string
  /** Die Unternehmung stand nicht zur Auswahl, sie ist ein eigener Vorschlag. */
  ownIdea: boolean
  /** Der Zeitpunkt liegt ausserhalb der Fenster, die angeboten wurden. */
  ownTime: boolean
  message: string | null
  event: Parameters<typeof buildIcs>[0]
}) {
  const result = await send({
    to: args.to,
    subject: `${args.who} hat zugesagt: ${args.what}`,
    text: [
      `${args.who} hat deinen Tresor geöffnet und zugesagt.`,
      '',
      `Was:  ${args.what}${args.ownIdea ? '  (eigener Vorschlag)' : ''}`,
      `Wann: ${args.when} (${args.timezone})${args.ownTime ? '  (eigener Termin)' : ''}`,
      args.message ? `\nNachricht: „${args.message}"` : '',
      // Der Ersteller hat diese Unternehmung oder dieses Fenster nie
      // angeboten — das darf er nicht überlesen.
      args.ownIdea || args.ownTime
        ? `\n${describeProposal(args.ownIdea, args.ownTime)}`
        : '',
      '',
      `Der Termin liegt als Kalenderdatei bei.`,
      `Ohne .ics-Anhang geht es auch hier: ${googleCalendarUrl(args.event)}`,
    ].join('\n'),
    attachments: [
      {
        filename: 'voulez-termin.ics',
        content: Buffer.from(buildIcs(args.event), 'utf-8').toString('base64'),
        contentType: 'text/calendar; charset=utf-8; method=PUBLISH',
      },
    ],
  })
  if (!result.ok) console.error('Zusage-Mail nicht zustellbar', result)
}

/** Ein Satz, der sagt, worauf der Ersteller sich einlässt. */
function describeProposal(ownIdea: boolean, ownTime: boolean): string {
  if (ownIdea && ownTime) {
    return 'Unternehmung und Zeitpunkt sind eigene Vorschläge — beides stand so nicht zur Auswahl.'
  }
  if (ownIdea) return 'Diese Unternehmung stand nicht zur Auswahl, sie ist ein Vorschlag.'
  return 'Dieser Zeitpunkt liegt ausserhalb der Fenster, die du angeboten hast.'
}

async function notifyDecline(to: string, who: string, message?: string) {
  const result = await send({
    to,
    subject: `${who} hat geantwortet`,
    text: [
      `${who} hat deinen Tresor geöffnet, passt aber gerade nicht.`,
      message ? `\nNachricht: „${message}"` : '',
    ].join('\n'),
  })
  if (!result.ok) console.error('Absage-Mail nicht zustellbar', result)
}

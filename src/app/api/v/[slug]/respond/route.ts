import { z } from 'zod'
import { db } from '@/lib/supabase/server'
import { env } from '@/lib/env'
import { errors, ok } from '@/lib/http'
import { send } from '@/lib/mail'
import { allow, clientFingerprint, LIMITS } from '@/lib/rate-limit'
import { hasUnlocked } from '@/lib/session'
import { formatDateTime, slotTimes, zonedToUtc } from '@/lib/time'
import { findVault, logEvent, playable } from '@/lib/vault'

const bodySchema = z.discriminatedUnion('accepted', [
  z.object({
    accepted: z.literal(true),
    optionId: z.uuid(),
    day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    time: z.string().regex(/^\d{2}:\d{2}$/),
    durationMin: z.number().int().min(30).max(600).default(120),
    message: z.string().max(500).optional(),
  }),
  z.object({
    accepted: z.literal(false),
    message: z.string().max(500).optional(),
  }),
])

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

    void notifyDecline(vault.creator_email, vault.recipient_name, body.data.message)
    return ok({ saved: true, accepted: false })
  }

  const { optionId, day, time, durationMin, message } = body.data

  const { data: option } = await db()
    .from('date_options')
    .select('id,label')
    .eq('id', optionId)
    .eq('vault_id', vault.id)
    .maybeSingle()
  if (!option) return errors.badRequest('Diese Option gibt es nicht.')

  // Der Zeitpunkt muss in einem der freigegebenen Fenster liegen. Der Client
  // bietet nur gültige an — verlassen kann man sich darauf nicht.
  const { data: slots } = await db()
    .from('date_slots')
    .select('day,time_from,time_to')
    .eq('vault_id', vault.id)
    .eq('day', day)

  const valid = (slots ?? []).some((slot) =>
    slotTimes(slot.time_from.slice(0, 5), slot.time_to.slice(0, 5)).includes(time),
  )
  if (!valid) return errors.badRequest('Dieser Zeitpunkt ist nicht freigegeben.')

  const startsAt = zonedToUtc(day, time, vault.timezone)

  const { error } = await db()
    .from('responses')
    .insert({
      vault_id: vault.id,
      accepted: true,
      option_id: option.id,
      starts_at: startsAt.toISOString(),
      duration_min: durationMin,
      message: message ?? null,
    })
  if (error) {
    console.error('Antwort konnte nicht gespeichert werden', error)
    return errors.badRequest('Die Antwort konnte nicht gespeichert werden.')
  }

  await db().from('vaults').update({ status: 'answered' }).eq('id', vault.id)
  logEvent(vault.id, 'answered', { accepted: true, optionId: option.id })

  void notifyAccept({
    to: vault.creator_email,
    who: vault.recipient_name,
    what: option.label,
    when: formatDateTime(startsAt.toISOString(), vault.timezone),
    message: message ?? null,
    slug,
  })

  return ok({
    saved: true,
    accepted: true,
    ticket: {
      optionLabel: option.label,
      startsAt: startsAt.toISOString(),
      durationMin,
      message: message ?? null,
    },
  })
}

async function notifyAccept(args: {
  to: string
  who: string
  what: string
  when: string
  message: string | null
  slug: string
}) {
  await send({
    to: args.to,
    subject: `${args.who} hat zugesagt: ${args.what}`,
    text: [
      `${args.who} hat deinen Tresor geöffnet und zugesagt.`,
      '',
      `Was:  ${args.what}`,
      `Wann: ${args.when}`,
      args.message ? `\nNachricht: „${args.message}"` : '',
      '',
      `Ticket ansehen: ${env.siteUrl}/v/${args.slug}/ticket`,
    ].join('\n'),
  })
}

async function notifyDecline(to: string, who: string, message?: string) {
  await send({
    to,
    subject: `${who} hat geantwortet`,
    text: [
      `${who} hat deinen Tresor geöffnet, passt aber gerade nicht.`,
      message ? `\nNachricht: „${message}"` : '',
    ].join('\n'),
  })
}

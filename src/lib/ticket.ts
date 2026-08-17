import 'server-only'

import type { TicketData } from '@/components/invitation/ticket'
import { hashToken } from '@/lib/crypto'
import { env } from '@/lib/env'
import type { buildIcs } from '@/lib/ics'
import { db } from '@/lib/supabase/server'
import { playable, vaultById } from '@/lib/vault'

/**
 * Das gespeicherte Ticket.
 *
 * Der Link zur Zusage ist ein Capability-Link: wer ihn hat, sieht die Karte —
 * ohne PIN, ohne Rätsel, ohne Öffnungs-Cookie. Genau das ist der Zweck. Der
 * Besuch soll seine Verabredung morgen noch aufrufen können, auch auf einem
 * anderen Gerät, und den Ersteller muss man nicht durch den Tresor schicken,
 * den er selbst gebaut hat.
 *
 * Die Gegenleistung: der Token ist 32 Byte Zufall und steht in keiner Mail
 * an Dritte. Gespeichert wird nur sein Hash.
 */
export type SavedTicket = {
  data: TicketData
  /** Fertig für `buildIcs` — der Kalendereintrag hängt an denselben Daten. */
  event: Parameters<typeof buildIcs>[0]
  /** Nur fürs Ereignis-Log. Vom Ticket-Link aus ist der Tresor sonst namenlos. */
  vaultId: string
}

/** Base64url aus `newToken()`. Alles andere spart die Runde zur Datenbank. */
const TOKEN = /^[A-Za-z0-9_-]{20,64}$/

export function ticketUrl(token: string): string {
  return `${env.siteUrl}/t/${token}`
}

export async function findTicket(token: string): Promise<SavedTicket | null> {
  if (!TOKEN.test(token)) return null

  const { data: response } = await db()
    .from('responses')
    .select(
      'id,vault_id,accepted,starts_at,duration_min,created_at,option_id,custom_label,message',
    )
    .eq('ticket_token_hash', hashToken(token))
    .maybeSingle()

  if (!response?.accepted || !response.starts_at) return null

  // Ein gesperrter oder abgelaufener Tresor zeigt auch sein Ticket nicht mehr.
  // Gelöscht wird beides ohnehin gemeinsam, 90 Tage nach dem Anlegen.
  const state = playable(await vaultById(response.vault_id))
  if (!state.ok) return null
  const vault = state.vault

  const { data: option } = response.option_id
    ? await db()
        .from('date_options')
        .select('label,description')
        .eq('id', response.option_id)
        .maybeSingle()
    : { data: null }

  // Ohne Option steht dort der eigene Vorschlag des Besuchs.
  const what = option?.label ?? response.custom_label ?? 'Unternehmung'

  return {
    vaultId: vault.id,
    data: {
      slug: vault.slug,
      optionLabel: what,
      startsAt: response.starts_at,
      durationMin: response.duration_min,
      message: response.message,
      recipientName: vault.recipient_name,
      hostName: vault.creator_name,
      timezone: vault.timezone,
    },
    event: {
      uid: `${response.id}@voulez`,
      start: new Date(response.starts_at),
      createdAt: new Date(response.created_at),
      durationMinutes: response.duration_min,
      title: `${what} mit ${vault.creator_name ?? vault.recipient_name}`,
      description: option?.description ?? undefined,
      // Bewusst ohne ORGANIZER: den Link kann der Besuch weiterreichen, die
      // Adresse des Erstellers gehört nicht ungefragt mit.
    },
  }
}

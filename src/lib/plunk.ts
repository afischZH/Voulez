import 'server-only'

import { env } from '@/lib/env'

/**
 * Basis der Plunk-API. Der Versand in `mail.ts` hängt daran genauso wie die
 * Kontaktpflege hier.
 *
 * Nicht `api.useplunk.com`: das ist die ältere Fassung, auf der zwar
 * `/v1/send` liegt, aber keine der Kontakt-Routen — und unser Key wird dort
 * überhaupt nicht erkannt. Die aktuelle Dokumentation nennt diesen Host.
 */
export const PLUNK_API = 'https://next-api.useplunk.com'

/**
 * Plunk legt zu jeder Empfängeradresse einen Kontakt an — die Versand-API
 * kennt keinen Weg daran vorbei. Dieses Modul räumt hinter ihr auf: entweder
 * sofort nach dem Versand (`send({ forget: true })`) oder nachgelagert, wenn
 * die zugesagte Aufbewahrungsfrist abgelaufen ist.
 */
function authHeader(): Record<string, string> {
  return { authorization: `Bearer ${env.plunkApiKey}` }
}

/**
 * Löscht einen Kontakt. Wirft nie — beide Aufrufer laufen hinter einer schon
 * erledigten Arbeit her (die Mail ist raus, der Tresor ist längst abgelaufen)
 * und dürfen daran nicht scheitern.
 *
 * Im Log steht die Kontakt-ID und nicht die Adresse: eine Adresse, die wir
 * gerade loswerden wollen, gehört nicht noch in eine zweite Ablage.
 */
export async function deleteContact(id: string): Promise<boolean> {
  try {
    const res = await fetch(`${PLUNK_API}/contacts/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: authHeader(),
    })
    if (!res.ok) {
      console.error(
        `[plunk] Kontakt ${id} bleibt stehen: ${res.status} ${await res.text()}`,
      )
      return false
    }
    return true
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error(`[plunk] Kontakt ${id} bleibt stehen: ${detail}`)
    return false
  }
}

export type PurgeResult = {
  deleted: number
  failed: number
  /** Das Limit dieses Laufs war erreicht, es sind noch alte Kontakte offen. */
  more: boolean
}

type ContactPage = { data?: { id?: string; createdAt?: string }[] }

/** Plunks Maximum pro Seite. */
const PAGE = 100

/**
 * Löscht alle Kontakte, die älter sind als die Aufbewahrungsfrist.
 *
 * Der Massstab ist bewusst das Alter des Kontakts und nicht der Tresor:
 * Plunk-Kontakte entstehen in diesem Projekt ausschliesslich durch unseren
 * Versand, und ein Kontakt von vor 90 Tagen gehört zu einem Tresor, den es
 * nicht mehr gibt. Wer dasselbe Plunk-Projekt noch für anderes benutzt,
 * verliert hier also Adressen — es soll ein Projekt nur für Voulez sein.
 *
 * Es wird nach jedem Durchgang neu von vorn gelesen, statt einen Cursor
 * mitzuführen: die Liste ändert sich ja gerade durch das Löschen, und ein
 * Cursor würde dabei Einträge überspringen. Aufsteigend sortiert steht das
 * Älteste vorn, ein Durchgang ohne Treffer beendet den Lauf.
 */
export async function purgeContacts(options?: {
  olderThanDays?: number
  /** Deckel pro Lauf, damit die Funktion nicht in ihr Zeitlimit rennt. */
  maxDeletions?: number
}): Promise<PurgeResult> {
  const olderThanDays = options?.olderThanDays ?? 90
  const maxDeletions = options?.maxDeletions ?? 200
  const cutoff = Date.now() - olderThanDays * 24 * 60 * 60 * 1000

  let deleted = 0
  let failed = 0

  while (deleted + failed < maxDeletions) {
    const res = await fetch(
      `${PLUNK_API}/contacts?limit=${PAGE}&sort=createdAt&dir=asc`,
      {
        headers: authHeader(),
        cache: 'no-store',
      },
    )
    if (!res.ok) {
      // Anders als beim Löschen: ohne Liste ist der Lauf nicht durchführbar,
      // und das soll der Aufrufer als Fehlschlag sehen.
      throw new Error(`Kontaktliste nicht lesbar: ${res.status} ${await res.text()}`)
    }

    const page = (await res.json()) as ContactPage
    const contacts = page.data ?? []
    const stale = contacts.filter(
      (c): c is { id: string; createdAt: string } =>
        !!c.id && !!c.createdAt && new Date(c.createdAt).getTime() < cutoff,
    )
    if (stale.length === 0) return { deleted, failed, more: false }

    for (const contact of stale) {
      if (deleted + failed >= maxDeletions) return { deleted, failed, more: true }
      if (await deleteContact(contact.id)) deleted++
      else failed++
    }

    // Die Seite war nicht voll mit Altem — dahinter stehen nur jüngere
    // Kontakte, ein weiterer Durchgang fände nichts mehr.
    if (stale.length < contacts.length || contacts.length < PAGE) {
      return { deleted, failed, more: false }
    }
  }

  return { deleted, failed, more: true }
}

import { timingSafeEqual } from 'node:crypto'
import { fail, ok } from '@/lib/http'
import { purgeContacts } from '@/lib/plunk'
import { purgeExpiredVaults, purgeStaleRateLimits } from '@/lib/retention'

/**
 * Der tägliche Lauf, der die Zusage der Datenschutzerklärung einlöst: nach 90
 * Tagen ist ein Tresor weg, samt Rätseln, Antwort und E-Mail-Adresse.
 *
 * Drei Ablagen, drei Schritte — die Datenbank (Tresore samt Anhang), die
 * Rate-Limit-Zeilen mit ihren IP-Hashes und die Kontakte, die Plunk beim
 * Versand anlegt und von sich aus ewig behält.
 *
 * Gedacht für Vercel Cron (`vercel.json`), aufrufbar aber auch von Hand:
 *
 *     curl -H "Authorization: Bearer $CRON_SECRET" https://voulez.love/api/cron/cleanup
 */
export const maxDuration = 60

/** Zur Frist der Datenschutzerklärung passend — beide zusammen ändern. */
const RETENTION_DAYS = 90

/**
 * Deckel für die Kontakte pro Lauf. Bei einem täglichen Cron fallen
 * normalerweise eine Handvoll an; die Grenze fängt nur den Fall ab, dass der
 * Lauf lange ausgesetzt hat, und hält ihn innerhalb von `maxDuration`. Der
 * nächste Tag räumt den Rest. Die beiden Datenbank-Schritte brauchen keinen
 * Deckel, sie sind je ein einziges DELETE.
 */
const MAX_CONTACTS_PER_RUN = 200

function authorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim()
  if (!secret) return false

  // Vercel Cron schickt genau diesen Header, sobald CRON_SECRET gesetzt ist.
  const expected = Buffer.from(`Bearer ${secret}`)
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET?.trim()) {
    console.error('[cron] CRON_SECRET ist nicht gesetzt — der Aufräum-Lauf bleibt zu.')
    return fail(
      503,
      'not_configured',
      'Der Aufräum-Lauf ist auf diesem Server nicht eingerichtet.',
    )
  }
  if (!authorized(request)) {
    return fail(401, 'unauthorized', 'Dieser Endpunkt gehört dem Cron.')
  }

  // Jeder Schritt für sich: ein streikendes Plunk darf die Tresore nicht
  // stehen lassen, und eine klemmende Datenbank nicht die Kontakte.
  const failures: string[] = []

  const vaults = await step('Tresore', failures, purgeExpiredVaults)
  const rateLimits = await step('Rate-Limits', failures, purgeStaleRateLimits)
  const contacts = await step('Kontakte', failures, async () => {
    const result = await purgeContacts({
      olderThanDays: RETENTION_DAYS,
      maxDeletions: MAX_CONTACTS_PER_RUN,
    })
    if (result.failed > 0) {
      failures.push(`Kontakte: ${result.failed} nicht gelöscht`)
    }
    return result
  })

  // Nur wenn gar nichts durchkam, war der Lauf ein Fehlschlag. Sonst 200 mit
  // den Zahlen: ein 500 würde Vercel bloss zu einer Wiederholung mit
  // denselben Daten bewegen, und was gelöscht ist, bleibt gelöscht.
  if (vaults === null && rateLimits === null && contacts === null) {
    console.error('[cron] Aufräum-Lauf komplett gescheitert:', failures.join('; '))
    return fail(502, 'cleanup_failed', 'Der Aufräum-Lauf ist gescheitert.')
  }

  const report = {
    vaults,
    rateLimits,
    contacts,
    ...(failures.length ? { failures } : {}),
  }
  console.info(`[cron] Aufräum-Lauf: ${JSON.stringify(report)}`)
  return ok(report)
}

/** Führt einen Schritt aus und merkt sich seinen Fehler, statt abzubrechen. */
async function step<T>(
  name: string,
  failures: string[],
  run: () => Promise<T>,
): Promise<T | null> {
  try {
    return await run()
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error(`[cron] ${name} nicht aufgeräumt: ${detail}`)
    failures.push(`${name}: ${detail}`)
    return null
  }
}

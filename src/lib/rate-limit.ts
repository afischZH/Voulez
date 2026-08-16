import 'server-only'

import { createHash } from 'node:crypto'
import { db } from '@/lib/supabase/server'

/**
 * DB-gestütztes Rate-Limit. In einer Serverless-Umgebung teilen sich die
 * Instanzen keinen Speicher, ein In-Memory-Zähler wäre also wirkungslos —
 * und genau dieser Zähler ist der eigentliche Schutz der PIN.
 */
export async function allow(
  bucket: string,
  limit: number,
  windowSeconds: number,
): Promise<boolean> {
  const { data, error } = await db().rpc('hit_rate_limit', {
    p_bucket: bucket,
    p_limit: limit,
    p_window: `${windowSeconds} seconds`,
  })

  // Im Zweifel dichtmachen: ein kaputtes Limit darf kein offenes Tor sein.
  if (error) {
    console.error('rate limit failed', error)
    return false
  }
  return data === true
}

/**
 * IP aus den Proxy-Headern. Nur gehasht verwenden — die rohe IP landet
 * damit nie in der Datenbank.
 */
export function clientFingerprint(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  const ip = forwarded || req.headers.get('x-real-ip') || 'unknown'
  return createHash('sha256').update(ip).digest('base64url').slice(0, 22)
}

/** Zähler-Bucket für Fehlversuche an einem Rätsel (nicht limitierend). */
export function missBucket(puzzleId: string, fingerprint: string): string {
  return `miss:${puzzleId}:${fingerprint}`
}

/**
 * Zählt hoch, ohne zu limitieren. Die Obergrenze muss in ein Postgres
 * `integer` passen — mit Number.MAX_SAFE_INTEGER wirft die RPC, und der
 * Zähler bleibt stumm auf null stehen.
 */
export async function bump(bucket: string, windowSeconds = 86_400): Promise<void> {
  await allow(bucket, 1_000_000, windowSeconds)
}

/** Wie oft dieser Besucher an diesem Rätsel schon danebenlag. */
export async function missCount(bucket: string): Promise<number> {
  const { data } = await db()
    .from('rate_limits')
    .select('hits')
    .eq('bucket', bucket)
    .maybeSingle()
  return data?.hits ?? 0
}

export const LIMITS = {
  /** PIN-Versuche pro Tresor und IP */
  unlock: { limit: 12, windowSeconds: 300 },
  /** Rätsel-Antworten pro Tresor und IP */
  puzzle: { limit: 60, windowSeconds: 300 },
  /** Neue Tresore pro IP — gegen Massen-Anlage */
  create: { limit: 5, windowSeconds: 3600 },
  /** Antwort abschicken */
  respond: { limit: 10, windowSeconds: 3600 },
  /** Ticket per E-Mail — knapp gehalten, weil der Besucher die Zieladresse
   *  frei tippt und der Endpunkt sonst als Versandweg missbraucht würde. */
  ticketMail: { limit: 4, windowSeconds: 3600 },
} as const

import 'server-only'

import { db } from '@/lib/supabase/server'

/**
 * Was die Datenschutzerklärung zusagt, tatsächlich ausführen.
 *
 * `expires_at` steht in der Datenbank auf `created_at + 90 Tage` und wird
 * nirgends überschrieben — abgelaufen heisst hier also genau das, was dort
 * steht: 90 Tage nach der Erstellung. Ein Tresor, der nie bestätigt wurde,
 * ist davon nicht ausgenommen; er läuft nach derselben Frist ab.
 */
export async function purgeExpiredVaults(): Promise<number> {
  // Ein einziges DELETE reicht: date_options, date_slots, responses,
  // vault_events und vault_puzzles hängen alle mit ON DELETE CASCADE am
  // Tresor. Was hier verschwindet, verschwindet vollständig.
  const { count, error } = await db()
    .from('vaults')
    .delete({ count: 'exact' })
    .lt('expires_at', new Date().toISOString())

  if (error) throw new Error(`Tresore nicht löschbar: ${error.message}`)
  return count ?? 0
}

/**
 * Das längste Zählfenster in `LIMITS` ist ein Tag, die Miss-Zähler laufen
 * über 24 Stunden. Eine Woche Abstand ist also weit jenseits von allem, was
 * noch gebraucht wird — und ohne diesen Schnitt wachsen die Zeilen mit ihren
 * IP-Hashes unbegrenzt weiter.
 */
const RATE_LIMIT_KEEP_DAYS = 7

export async function purgeStaleRateLimits(): Promise<number> {
  const cutoff = new Date(Date.now() - RATE_LIMIT_KEEP_DAYS * 24 * 60 * 60 * 1000)
  const { count, error } = await db()
    .from('rate_limits')
    .delete({ count: 'exact' })
    .lt('window_start', cutoff.toISOString())

  if (error) throw new Error(`Rate-Limit-Zeilen nicht löschbar: ${error.message}`)
  return count ?? 0
}

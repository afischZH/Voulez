import { z } from 'zod'
import { db } from '@/lib/supabase/server'
import { puzzleFor } from '@/lib/puzzles'
import { errors, ok } from '@/lib/http'
import { allow, bump, clientFingerprint, LIMITS, missBucket } from '@/lib/rate-limit'
import { findVault, logEvent, playable } from '@/lib/vault'

const bodySchema = z.union([
  z.object({ attempt: z.unknown() }),
  // Memory deckt Karte für Karte auf, statt das Kartenbild mitzuliefern.
  z.object({ peek: z.number().int().min(0).max(31) }),
])

/**
 * Prüft einen Rätsel-Versuch. Die Lösung verlässt den Server nie — der
 * Client erfährt nur "richtig" oder "falsch", eine Rückmeldung ohne
 * Lösungsverrat, und im Erfolgsfall die eine PIN-Ziffer.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; puzzleId: string }> },
) {
  const { slug, puzzleId } = await params

  const fingerprint = clientFingerprint(request)
  const permitted = await allow(
    `puzzle:${slug}:${fingerprint}`,
    LIMITS.puzzle.limit,
    LIMITS.puzzle.windowSeconds,
  )
  if (!permitted) return errors.tooMany(LIMITS.puzzle.windowSeconds)

  const state = playable(await findVault(slug))
  if (!state.ok) {
    return state.reason === 'expired' ? errors.gone() : errors.notFound()
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return errors.badRequest()

  const { data: row } = await db()
    .from('vault_puzzles')
    .select('*')
    .eq('id', puzzleId)
    .eq('vault_id', state.vault.id)
    .maybeSingle()
  if (!row) return errors.notFound()

  const definition = puzzleFor(row.type)
  if (!definition) return errors.notFound()

  const config = definition.configSchema.safeParse(row.config)
  if (!config.success) {
    console.error('ungueltige Raetsel-Konfiguration', row.id, config.error)
    return errors.notFound()
  }

  const context = { puzzleId: row.id }

  if ('peek' in body.data) {
    if (!definition.peek) return errors.badRequest()
    return ok({ value: definition.peek(config.data, body.data.peek, context) })
  }

  const attempt = definition.attemptSchema.safeParse(body.data.attempt)
  if (!attempt.success) return errors.badRequest('Der Versuch war ungültig.')

  if (definition.verify(config.data, attempt.data, context)) {
    logEvent(state.vault.id, 'puzzle_solved', { puzzleId: row.id })
    return ok({ correct: true, position: row.position, digit: row.reveal_digit })
  }

  // Fehlversuche mitzählen — sie sind der Eintrittspreis für den Notausgang
  // in ./surrender.
  await bump(missBucket(puzzleId, fingerprint))

  return ok({
    correct: false,
    feedback: definition.feedback?.(config.data, attempt.data, context) ?? null,
  })
}

import { db } from '@/lib/supabase/server'
import { errors, ok } from '@/lib/http'
import { clientFingerprint, missBucket, missCount } from '@/lib/rate-limit'
import { findVault, logEvent, playable } from '@/lib/vault'

/** So oft muss man danebengelegen haben, bevor es die Ziffer geschenkt gibt. */
const MERCY_AFTER = 3

/**
 * Der Notausgang. Vor einem Rätsel aufzugeben ist das schlechteste denkbare
 * Ende dieser Seite — schlimmer als eine geschenkte Ziffer. Wer nachweislich
 * dreimal falsch lag, bekommt sie.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string; puzzleId: string }> },
) {
  const { slug, puzzleId } = await params

  const state = playable(await findVault(slug))
  if (!state.ok) {
    return state.reason === 'expired' ? errors.gone() : errors.notFound()
  }

  const misses = await missCount(missBucket(puzzleId, clientFingerprint(request)))
  if (misses < MERCY_AFTER) {
    return errors.badRequest('Noch nicht. Probier es zuerst.')
  }

  const { data: row } = await db()
    .from('vault_puzzles')
    .select('reveal_digit')
    .eq('id', puzzleId)
    .eq('vault_id', state.vault.id)
    .maybeSingle()
  if (!row) return errors.notFound()

  logEvent(state.vault.id, 'puzzle_solved', { puzzleId, surrendered: true })
  return ok({ digit: row.reveal_digit })
}

import { z } from 'zod'
import { verifyPin } from '@/lib/crypto'
import { db } from '@/lib/supabase/server'
import { errors, ok } from '@/lib/http'
import { allow, clientFingerprint, LIMITS } from '@/lib/rate-limit'
import { grantUnlocked } from '@/lib/session'
import { findVault, logEvent, openedView, playable } from '@/lib/vault'

const bodySchema = z.object({
  pin: z.string().regex(/^\d{2,8}$/),
})

/**
 * Der Moment, auf den alles hinausläuft. Erst hier — nach geprüfter PIN —
 * gibt der Server den Hinweistext und die Auswahlmöglichkeiten heraus.
 * Vorher existieren sie für den Browser schlicht nicht.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const fingerprint = clientFingerprint(request)
  const permitted = await allow(
    `unlock:${slug}:${fingerprint}`,
    LIMITS.unlock.limit,
    LIMITS.unlock.windowSeconds,
  )
  if (!permitted) return errors.tooMany(LIMITS.unlock.windowSeconds)

  const state = playable(await findVault(slug))
  if (!state.ok) {
    return state.reason === 'expired' ? errors.gone() : errors.notFound()
  }
  const vault = state.vault

  // Zweite Bremse neben dem IP-Limit: der Tresor selbst verriegelt sich.
  if (vault.locked_until && new Date(vault.locked_until) > new Date()) {
    return errors.locked(vault.locked_until)
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return errors.badRequest('Die PIN hat das falsche Format.')

  if (!(await verifyPin(body.data.pin, vault.pin_hash))) {
    const { data: lockedUntil } = await db().rpc('register_failed_unlock', {
      p_vault_id: vault.id,
    })
    logEvent(vault.id, 'unlock_failed')

    if (lockedUntil && new Date(lockedUntil) > new Date()) {
      return errors.locked(lockedUntil)
    }
    return ok({ opened: false })
  }

  await db()
    .from('vaults')
    .update({ failed_attempts: 0, locked_until: null })
    .eq('id', vault.id)

  await grantUnlocked(slug, vault.id)
  logEvent(vault.id, 'unlocked')

  return ok({ opened: true, vault: await openedView(vault) })
}

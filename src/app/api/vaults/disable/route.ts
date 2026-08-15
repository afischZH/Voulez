import { z } from 'zod'
import { hashToken } from '@/lib/crypto'
import { errors, ok } from '@/lib/http'
import { allow, clientFingerprint } from '@/lib/rate-limit'
import { db } from '@/lib/supabase/server'

const bodySchema = z.object({ token: z.string().min(20).max(64) })

/** Deaktiviert einen Tresor. Der Verwaltungstoken ist der einzige Nachweis. */
export async function POST(request: Request) {
  // Der Token ist 32 Byte lang — geraten wird er nicht. Das Limit bremst
  // trotzdem, falls es jemand versucht.
  const permitted = await allow(`disable:${clientFingerprint(request)}`, 20, 3600)
  if (!permitted) return errors.tooMany(3600)

  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return errors.badRequest()

  const { data, error } = await db()
    .from('vaults')
    .update({ status: 'disabled' })
    .eq('edit_token_hash', hashToken(body.data.token))
    .select('id')
    .maybeSingle()

  if (error || !data) return errors.notFound()
  return ok({ disabled: true })
}

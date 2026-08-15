import { db } from '@/lib/supabase/server'
import { errors } from '@/lib/http'
import { buildIcs } from '@/lib/ics'
import { hasUnlocked } from '@/lib/session'
import { findVault, playable } from '@/lib/vault'

/** Der Kalendereintrag zum Ticket. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params

  const state = playable(await findVault(slug))
  if (!state.ok) return errors.notFound()
  const vault = state.vault

  if (!(await hasUnlocked(slug, vault.id))) return errors.notFound()

  const { data: response } = await db()
    .from('responses')
    .select('id,accepted,starts_at,duration_min,created_at,option_id')
    .eq('vault_id', vault.id)
    .maybeSingle()

  if (!response?.accepted || !response.starts_at) return errors.notFound()

  const { data: option } = response.option_id
    ? await db()
        .from('date_options')
        .select('label,description')
        .eq('id', response.option_id)
        .maybeSingle()
    : { data: null }

  const title = option?.label ?? 'Unternehmung'

  const ics = buildIcs({
    uid: `${response.id}@voulez`,
    start: new Date(response.starts_at),
    createdAt: new Date(response.created_at),
    durationMinutes: response.duration_min,
    title: `${title} mit ${vault.creator_name ?? vault.recipient_name}`,
    description: option?.description ?? vault.reveal_text,
    organizerEmail: vault.creator_email,
  })

  return new Response(ics, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="voulez-${slug}.ics"`,
      'cache-control': 'no-store',
    },
  })
}

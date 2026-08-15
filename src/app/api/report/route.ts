import { z } from 'zod'
import { env } from '@/lib/env'
import { errors, ok } from '@/lib/http'
import { send } from '@/lib/mail'
import { allow, clientFingerprint } from '@/lib/rate-limit'
import { db } from '@/lib/supabase/server'

const bodySchema = z.object({
  slug: z.string().min(1).max(120),
  reason: z.string().min(10).max(2000),
  contact: z.string().max(160).optional(),
})

/**
 * Missbrauchsmeldung. Die Meldung sperrt nichts automatisch — sonst liesse
 * sich die Funktion selbst als Waffe benutzen. Sie geht an den Betreiber,
 * der entscheidet.
 */
export async function POST(request: Request) {
  const permitted = await allow(`report:${clientFingerprint(request)}`, 5, 3600)
  if (!permitted) return errors.tooMany(3600)

  const body = bodySchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return errors.badRequest('Bitte Kennung und Begründung ausfüllen.')

  // Aus einem ganzen Link die Kennung ziehen — die meisten kopieren die URL.
  const slug = body.data.slug
    .trim()
    .replace(/^.*\/v\//, '')
    .replace(/[?#].*$/, '')

  const { data: vault } = await db()
    .from('vaults')
    .select('id, status, created_at')
    .eq('slug', slug)
    .maybeSingle()

  await send({
    to: env.reportTo,
    subject: `Missbrauchsmeldung: ${slug}`,
    text: [
      `Tresor: ${slug}`,
      vault
        ? `Status: ${vault.status}, angelegt ${vault.created_at}`
        : 'Kein Tresor mit dieser Kennung gefunden.',
      vault ? `Verwaltung: ${env.siteUrl}/v/${slug}` : '',
      '',
      'Begründung:',
      body.data.reason,
      '',
      body.data.contact ? `Rückmeldung an: ${body.data.contact}` : 'Keine Kontaktangabe.',
    ].join('\n'),
  })

  // Auch wenn es den Tresor nicht gibt: bestätigen. Sonst wäre das Formular
  // ein Werkzeug, um gültige Kennungen zu erraten.
  return ok({ received: true })
}

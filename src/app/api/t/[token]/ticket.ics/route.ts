import { errors } from '@/lib/http'
import { buildIcs } from '@/lib/ics'
import { findTicket } from '@/lib/ticket'

/**
 * Der Kalendereintrag zum gespeicherten Ticket.
 *
 * Kein Öffnungs-Cookie nötig: der Token in der Adresse ist der Nachweis —
 * derselbe, mit dem die Karte selbst erreichbar ist.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  const ticket = await findTicket(token)
  if (!ticket) return errors.notFound()

  return new Response(buildIcs(ticket.event), {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="voulez-${ticket.data.slug}.ics"`,
      'cache-control': 'no-store',
    },
  })
}

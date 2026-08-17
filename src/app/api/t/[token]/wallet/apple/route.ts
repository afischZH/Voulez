import { errors, fail } from '@/lib/http'
import { allow, clientFingerprint, LIMITS } from '@/lib/rate-limit'
import { findTicket } from '@/lib/ticket'
import { logEvent } from '@/lib/vault'
import { buildPkpass } from '@/lib/wallet/apple'
import { appleConfigured } from '@/lib/wallet/flags'

/**
 * Der Apple-Wallet-Pass zum gespeicherten Ticket.
 *
 * Kein Öffnungs-Cookie nötig: der Token in der Adresse ist der Nachweis —
 * derselbe, mit dem die Karte selbst erreichbar ist. Gesperrte, abgelaufene
 * und noch nicht bestätigte Tresore fallen in `findTicket` heraus.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  // Ohne Zertifikate gibt es diesen Endpunkt schlicht nicht.
  if (!appleConfigured()) return errors.notFound()

  // Anders als die .ics-Datei kostet jeder Pass eine RSA-Signatur. Der Eimer
  // hängt an der IP, nicht am Token: wer aufdreht, tut das mit einem Ticket.
  const permitted = await allow(
    `wallet:${clientFingerprint(request)}`,
    LIMITS.wallet.limit,
    LIMITS.wallet.windowSeconds,
  )
  if (!permitted) return errors.tooMany(LIMITS.wallet.windowSeconds)

  const ticket = await findTicket(token)
  if (!ticket) return errors.notFound()

  let pass: Uint8Array<ArrayBuffer>
  try {
    pass = await buildPkpass(ticket, token)
  } catch (error) {
    // Abgelaufenes Zertifikat, fehlende Bilder im Bündel: der Rest der
    // Ticketseite funktioniert weiter, nur dieser eine Knopf nicht.
    console.error('[wallet] pkpass nicht erzeugbar', error)
    return fail(
      503,
      'wallet_unavailable',
      'Der Wallet-Pass lässt sich gerade nicht erzeugen.',
    )
  }

  logEvent(ticket.vaultId, 'wallet_added', { wallet: 'apple' })

  return new Response(pass, {
    headers: {
      // Genau dieser Typ bringt iOS dazu, Wallet zu öffnen. Mit
      // application/octet-stream passiert kommentarlos nichts.
      'content-type': 'application/vnd.apple.pkpass',
      'content-disposition': `attachment; filename="voulez-${ticket.data.slug}.pkpass"`,
      'cache-control': 'no-store',
    },
  })
}

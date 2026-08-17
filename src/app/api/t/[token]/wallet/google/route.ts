import { errors, fail } from '@/lib/http'
import { allow, clientFingerprint, LIMITS } from '@/lib/rate-limit'
import { findTicket } from '@/lib/ticket'
import { logEvent } from '@/lib/vault'
import { googleConfigured } from '@/lib/wallet/flags'
import { saveUrl } from '@/lib/wallet/google'

/**
 * Weiterleitung zu „In Google Wallet speichern".
 *
 * Der Link entsteht erst hier und steht nie im Seitenquelltext: er ist ein
 * signierter JWT und damit ein Ausweis auf unsere Issuer-Identität. Das
 * seitenweite `Referrer-Policy: no-referrer` sorgt dafür, dass die Ticket-
 * Adresse dabei nicht als Referrer zu Google wandert.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params

  if (!googleConfigured()) return errors.notFound()

  const permitted = await allow(
    `wallet:${clientFingerprint(request)}`,
    LIMITS.wallet.limit,
    LIMITS.wallet.windowSeconds,
  )
  if (!permitted) return errors.tooMany(LIMITS.wallet.windowSeconds)

  const ticket = await findTicket(token)
  if (!ticket) return errors.notFound()

  let location: string
  try {
    location = saveUrl(ticket, token)
  } catch (error) {
    console.error('[wallet] Google-Link nicht erzeugbar', error)
    return fail(
      503,
      'wallet_unavailable',
      'Der Wallet-Pass lässt sich gerade nicht erzeugen.',
    )
  }

  logEvent(ticket.vaultId, 'wallet_added', { wallet: 'google' })

  // 302 und nicht das 307 von `NextResponse.redirect`: hier klickt jemand
  // einen Link, das ist der schlichte „schau stattdessen dort"-Fall.
  return new Response(null, {
    status: 302,
    headers: { location, 'cache-control': 'no-store' },
  })
}

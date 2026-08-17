import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { TicketView } from '@/components/invitation/ticket-view'
import { QuietFooter } from '@/components/vault/quiet-footer'
import { findTicket, ticketUrl } from '@/lib/ticket'
import { walletFlags } from '@/lib/wallet/flags'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ticket',
  robots: { index: false, follow: false },
}

/**
 * Das gespeicherte Ticket. Derselbe Abschluss wie nach der Zusage, nur ohne
 * den Weg dorthin: wer den Link hat, sieht die Karte.
 */
export default async function TicketPage({ params }: PageProps<'/t/[token]'>) {
  const { token } = await params

  const ticket = await findTicket(token)
  if (!ticket) notFound()

  return (
    <>
      <main className="flex flex-1 flex-col items-center px-5 py-14">
        <div className="my-auto flex w-full flex-col items-center">
          <p className="text-2xs text-brass-dim mb-8 tracking-[0.4em] uppercase print:hidden">
            Abgemacht
          </p>

          <TicketView
            data={ticket.data}
            token={token}
            url={ticketUrl(token)}
            wallet={walletFlags()}
          />
        </div>
      </main>

      <QuietFooter slug={ticket.data.slug} />
    </>
  )
}

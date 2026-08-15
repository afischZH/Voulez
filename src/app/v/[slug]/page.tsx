import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { QuietFooter } from '@/components/vault/quiet-footer'
import { VaultExperience } from '@/components/vault/vault-experience'
import { findVault, lockedView, logEvent, playable } from '@/lib/vault'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function VaultPage({ params }: PageProps<'/v/[slug]'>) {
  const { slug } = await params

  const state = playable(await findVault(slug))
  if (!state.ok) {
    if (state.reason === 'expired')
      return <Closed title="Zu spät" body="Dieser Tresor ist abgelaufen." />
    if (state.reason === 'draft')
      return (
        <Closed
          title="Noch nicht bereit"
          body="Dieser Tresor wartet noch auf die Bestätigung seines Absenders."
        />
      )
    notFound()
  }

  // Der Ersteller soll wissen, dass jemand vor der Tür stand — auch wenn
  // der Besucher nie öffnet.
  logEvent(state.vault.id, 'opened')

  return (
    <>
      <VaultExperience vault={await lockedView(state.vault)} />
      <QuietFooter slug={slug} />
    </>
  )
}

function Closed({ title, body }: { title: string; body: string }) {
  return (
    <main className="flex flex-1 items-center justify-center px-6 text-center">
      <div>
        <h1 className="font-display text-brass text-3xl tracking-wide">{title}</h1>
        <p className="text-fog mt-3">{body}</p>
      </div>
    </main>
  )
}

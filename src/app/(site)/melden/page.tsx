import type { Metadata } from 'next'
import { ReportForm } from '@/components/site/report-form'
import { Prose } from '@/components/site/prose'

export const metadata: Metadata = { title: 'Missbrauch melden' }

export default async function ReportPage({ searchParams }: PageProps<'/melden'>) {
  const { slug } = await searchParams
  const value = Array.isArray(slug) ? slug[0] : (slug ?? '')

  return (
    <Prose title="Missbrauch melden">
      <p>
        Die Inhalte der Tresore stammen von Nutzerinnen und Nutzern und werden nicht vorab
        geprüft. Wenn dich ein Tresor belästigt, bedroht oder Inhalte enthält, die hier
        nichts verloren haben, melde ihn. Wir sperren ihn, sobald wir die Meldung gesehen
        haben.
      </p>
      <p>
        <strong>Bei akuter Gefahr</strong> wende dich an die Polizei (117) und nicht
        zuerst an uns.
      </p>

      <ReportForm defaultSlug={value} />
    </Prose>
  )
}

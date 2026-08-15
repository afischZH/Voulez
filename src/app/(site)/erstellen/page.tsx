import type { Metadata } from 'next'
import { CreateWizard } from '@/components/create/create-wizard'

export const metadata: Metadata = {
  title: 'Tresor bauen · Voulez',
  description: 'Bau eine Einladung, die man erst öffnen muss.',
}

export default function CreatePage() {
  return <CreateWizard />
}

import Link from 'next/link'

/**
 * Rahmen für alles ausser dem Tresor selbst. Die Tresorseite bleibt bewusst
 * ohne Navigation und Footer — dort soll nichts vom Moment ablenken.
 */
export default function SiteLayout({ children }: LayoutProps<'/'>) {
  return (
    <>
      <header className="px-6 pt-7">
        <Link
          href="/"
          className="text-2xs text-brass-dim hover:text-brass tracking-[0.5em] uppercase transition-colors"
        >
          Voulez
        </Link>
      </header>

      {children}

      <footer className="border-steel-800/70 mt-16 border-t px-6 py-8">
        <nav className="text-fog-dim mx-auto flex max-w-3xl flex-wrap gap-x-6 gap-y-2 text-sm">
          <Link href="/impressum" className="hover:text-brass transition-colors">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:text-brass transition-colors">
            Datenschutz
          </Link>
          <Link href="/melden" className="hover:text-brass transition-colors">
            Missbrauch melden
          </Link>
        </nav>
      </footer>
    </>
  )
}

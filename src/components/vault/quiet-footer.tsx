import Link from 'next/link'

/**
 * Der einzige Ausgang aus dem Tresor. Bewusst leise gehalten, damit er die
 * Inszenierung nicht stört — aber vorhanden, weil jemand, der hier
 * belästigt wird, einen Weg braucht, der nicht "weiterspielen" heisst.
 */
export function QuietFooter({ slug }: { slug: string }) {
  return (
    <footer className="px-6 pb-8 text-center print:hidden">
      <Link
        href={`/melden?slug=${encodeURIComponent(slug)}`}
        className="text-fog-dim hover:text-fog text-2xs tracking-[0.2em] uppercase transition-colors"
      >
        Diese Seite melden
      </Link>
    </footer>
  )
}

/** Einheitlicher Rahmen für die Textseiten. */
export function Prose({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <main className="mx-auto w-full max-w-2xl px-6 py-14">
      <h1 className="font-display text-parchment text-3xl tracking-wide">{title}</h1>

      <div className="[&_a]:text-brass [&_h2]:font-display [&_h2]:text-brass [&_li]:text-fog [&_p]:text-fog [&_strong]:text-parchment mt-10 space-y-5 leading-relaxed [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-lg [&_h2]:tracking-wide [&_ul]:list-disc [&_ul]:space-y-2 [&_ul]:pl-5">
        {children}
      </div>
    </main>
  )
}

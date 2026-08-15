import type { Metadata, Viewport } from 'next'
import { Cinzel, Geist_Mono, Instrument_Sans } from 'next/font/google'
import { MotionProvider } from '@/components/motion-provider'
import './globals.css'

const cinzel = Cinzel({
  variable: '--font-cinzel',
  subsets: ['latin'],
  weight: ['400', '600'],
  display: 'swap',
})

const instrument = Instrument_Sans({
  variable: '--font-instrument',
  subsets: ['latin'],
  display: 'swap',
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  weight: ['400', '500'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: { default: 'Voulez', template: '%s · Voulez' },
  description: 'Eine Einladung, die man erst öffnen muss.',
}

export const viewport: Viewport = {
  themeColor: '#0a0d13',
  colorScheme: 'dark',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="de"
      className={`${cinzel.variable} ${instrument.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  )
}

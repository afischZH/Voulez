import type { NextConfig } from 'next'

/**
 * Ein Tresor-Link wandert per Chat weiter und wird auf fremden Geräten
 * geöffnet. Die Kopfzeilen unten sind deshalb keine Kür.
 */
const securityHeaders = [
  // Kein Framing: sonst liesse sich der Tresor in eine fremde Seite einbetten
  // und die Eingaben mitlesen.
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Der Slug steht im Pfad — er soll nicht als Referrer nach aussen wandern.
  { key: 'Referrer-Policy', value: 'no-referrer' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
]

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Die PNGs des Wallet-Passes werden zur Laufzeit von der Platte gelesen.
  // Ohne diesen Eintrag folgt der Tracer dem dynamischen `readFile` nicht,
  // die Bilder fehlen im Bündel der Serverless-Funktion — und der Pass
  // scheitert auf Vercel, während er lokal einwandfrei baut.
  //
  // Der Schlüssel steht bewusst mit `*` statt `[token]`: picomatch liest die
  // eckigen Klammern als Zeichenklasse. `*` überschreitet kein `/` und trifft
  // genau das eine dynamische Segment.
  outputFileTracingIncludes: {
    '/api/t/*/wallet/apple': ['./src/assets/wallet/**'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig

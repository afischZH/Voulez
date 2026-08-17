import 'server-only'

import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { zipSync } from 'fflate'
import forge from 'node-forge'
import { env } from '@/lib/env'
import type { SavedTicket } from '@/lib/ticket'
import { ticketUrl } from '@/lib/ticket'
import { formatDateOnly, formatDuration, formatTimeOnly } from '@/lib/time'

/**
 * Der Apple-Wallet-Pass.
 *
 * Ein `.pkpass` ist ein ZIP aus `pass.json`, den Bildern, einem `manifest.json`
 * mit einer Prüfsumme je Datei und einer abgetrennten PKCS#7-Signatur über
 * genau dieses Manifest. Alles davon entsteht hier auf dem Server — Apple
 * bekommt weder den Pass noch seinen Inhalt je zu sehen. Deshalb darf hier,
 * anders als beim Google-Pass, auch die persönliche Nachricht mit.
 *
 * Ohne Rückkanal: kein `webServiceURL`, kein `authenticationToken`. Eine
 * Voulez-Antwort ist unveränderlich, es gibt nichts nachzuschieben — und ein
 * Push-Kanal wollte ein zweites Zertifikat, vier Endpunkte und eine
 * Geräte-Tabelle in der 90-Tage-Löschung.
 */

const ASSET_NAMES = [
  'icon.png',
  'icon@2x.png',
  'icon@3x.png',
  'logo.png',
  'logo@2x.png',
] as const

/** Wie lange der Pass nach dem Termin noch gültig aussieht. */
const GRACE_MINUTES = 6 * 60

/**
 * Der fertige Pass.
 *
 * Der Rückgabetyp ist bewusst eng: `BodyInit` verlangt `ArrayBufferView` über
 * einem echten `ArrayBuffer`, und sowohl `zipSync` als auch `Buffer.from`
 * liefern nur das weichere `ArrayBufferLike`.
 */
export async function buildPkpass(
  ticket: SavedTicket,
  token: string,
): Promise<Uint8Array<ArrayBuffer>> {
  const files: Record<string, Uint8Array> = { ...(await assets()) }

  files['pass.json'] = new TextEncoder().encode(
    JSON.stringify(passJson(ticket, token), null, 2),
  )

  // Das Manifest deckt alle Dateien ab — nur sich selbst und die Signatur nicht.
  const manifestJson = JSON.stringify(manifest(files), null, 2)
  files['manifest.json'] = new TextEncoder().encode(manifestJson)
  files['signature'] = signManifest(manifestJson)

  // `level: 0` speichert statt zu komprimieren. Wallet akzeptiert beides, und
  // gespeicherte Einträge sind ein Fehlerbild weniger beim Debuggen.
  const zipped = zipSync(files, { level: 0 })
  const out = new Uint8Array(zipped.byteLength)
  out.set(zipped)
  return out
}

function passJson(ticket: SavedTicket, token: string): object {
  const { data } = ticket
  const url = ticketUrl(token)
  const start = new Date(data.startsAt)
  const expires = new Date(start.getTime() + (data.durationMin + GRACE_MINUTES) * 60_000)

  const backFields: { key: string; label: string; value: string }[] = [
    { key: 'link', label: 'Dein Ticket', value: url },
  ]
  if (data.message) {
    backFields.push({ key: 'note', label: 'Nachricht', value: data.message })
  }
  backFields.push(
    { key: 'code', label: 'Code', value: data.slug },
    { key: 'privacy', label: 'Datenschutz', value: `${env.siteUrl}/datenschutz` },
  )

  return {
    formatVersion: 1,
    passTypeIdentifier: env.applePassTypeId,
    teamIdentifier: env.appleTeamId,
    organizationName: 'Voulez',
    // Pflichtfeld und zugleich der Text, den VoiceOver vorliest.
    description: 'Voulez — Einladung',
    serialNumber: serialNumber(token),

    backgroundColor: 'rgb(10, 13, 19)',
    foregroundColor: 'rgb(243, 236, 224)',
    labelColor: 'rgb(200, 164, 77)',

    relevantDate: start.toISOString(),
    expirationDate: expires.toISOString(),

    barcodes: [
      {
        format: 'PKBarcodeFormatQR',
        message: url,
        messageEncoding: 'iso-8859-1',
        altText: data.slug,
      },
    ],

    eventTicket: {
      // Datum und Uhrzeit stehen bewusst als fertiger Text da, nicht als
      // Apple-Datumsfeld: `dateStyle` rendert in Sprache und Zeitzone des
      // Geräts. Der Pass soll dasselbe sagen wie Karte, Mail und Ausdruck.
      headerFields: [
        {
          key: 'time',
          label: 'ZEIT',
          value: formatTimeOnly(data.startsAt, data.timezone),
        },
      ],
      primaryFields: [{ key: 'event', label: '', value: data.optionLabel }],
      secondaryFields: [
        {
          key: 'date',
          label: 'DATUM',
          value: formatDateOnly(data.startsAt, data.timezone),
        },
        { key: 'guest', label: 'FÜR', value: data.recipientName },
      ],
      auxiliaryFields: [
        { key: 'host', label: 'MIT', value: data.hostName ?? '—' },
        {
          key: 'duration',
          label: 'DAUER',
          value: `ca. ${formatDuration(data.durationMin)}`,
        },
      ],
      backFields,
    },
  }
}

/**
 * Die Seriennummer.
 *
 * Deterministisch, damit ein zweiter Download dieselbe Karte aktualisiert
 * statt eine zweite anzulegen. Das eigene Präfix hält sie zugleich von
 * `hashToken()` fern: sie ist damit nicht der Wert, der als
 * `responses.ticket_token_hash` in der Datenbank steht.
 */
function serialNumber(token: string): string {
  return createHash('sha256')
    .update(`voulez:pkpass:v1:${token}`)
    .digest('base64url')
    .slice(0, 22)
}

/** SHA-1 je Datei — so verlangt Wallet es. Die Integrität trägt die Signatur. */
function manifest(files: Record<string, Uint8Array>): Record<string, string> {
  const entries = Object.entries(files).map(([name, bytes]) => [
    name,
    createHash('sha1').update(bytes).digest('hex'),
  ])
  return Object.fromEntries(entries)
}

/**
 * PKCS#7, abgetrennt, DER-kodiert. Node-`crypto` kann kein SignedData —
 * `createSign` liefert nur die rohe Signatur ohne die Zertifikatskette, die
 * Wallet erwartet. Genau diese eine Lücke füllt node-forge.
 */
function signManifest(manifestJson: string): Uint8Array {
  const { cert, key, wwdr } = signer()

  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(manifestJson, 'utf8')
  p7.addCertificate(wwdr)
  p7.addCertificate(cert)
  p7.addSigner({
    key,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      { type: forge.pki.oids.signingTime },
    ],
  })
  p7.sign({ detached: true })

  return Uint8Array.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), (c) => c.charCodeAt(0))
}

type Signer = {
  cert: forge.pki.Certificate
  key: forge.pki.rsa.PrivateKey
  wwdr: forge.pki.Certificate
}

let cachedSigner: Signer | null = null

/**
 * Memoisiert: das PEM-Parsen und der RSA-Schlüsselaufbau kosten spürbar mehr
 * als die Signatur selbst. Pro warmer Instanz fällt das genau einmal an.
 */
function signer(): Signer {
  if (cachedSigner) return cachedSigner
  return (cachedSigner = {
    cert: forge.pki.certificateFromPem(env.applePassCertPem),
    key: forge.pki.privateKeyFromPem(env.applePassKeyPem) as forge.pki.rsa.PrivateKey,
    // Apple Wallet akzeptiert nur die G4-Zwischenstelle. Mit G2, G3, G5 oder
    // G6 baut der Pass fehlerfrei und wird auf dem Gerät trotzdem abgelehnt.
    wwdr: forge.pki.certificateFromPem(env.appleWwdrPem),
  })
}

let cachedAssets: Record<string, Uint8Array> | null = null

/**
 * Die Bilder liegen unter `src/assets/wallet/` und werden zur Laufzeit von der
 * Platte gelesen. Damit sie auf Vercel überhaupt im Funktionsbündel landen,
 * zählt `next.config.ts` sie unter `outputFileTracingIncludes` auf — der
 * Tracer folgt einem dynamischen `readFile` nicht.
 */
async function assets(): Promise<Record<string, Uint8Array>> {
  if (cachedAssets) return cachedAssets
  const dir = path.join(process.cwd(), 'src/assets/wallet')
  const entries = await Promise.all(
    ASSET_NAMES.map(
      async (name) =>
        [name, new Uint8Array(await readFile(path.join(dir, name)))] as const,
    ),
  )
  return (cachedAssets = Object.fromEntries(entries))
}

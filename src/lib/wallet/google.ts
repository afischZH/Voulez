import 'server-only'

import { createHash, createSign } from 'node:crypto'
import { env } from '@/lib/env'
import type { SavedTicket } from '@/lib/ticket'
import { ticketUrl } from '@/lib/ticket'
import { formatDateTime, formatDuration } from '@/lib/time'

/**
 * Der „In Google Wallet speichern"-Link.
 *
 * Anders als beim Apple-Pass bleibt hier nichts auf dem Gerät: das Objekt
 * landet in Googles Systemen unter unserem Issuer-Konto und überlebt dort die
 * 90-Tage-Löschung aus `retention.ts`. Deshalb geht bewusst nur das Nötigste
 * mit — Vorname, Anlass, Termin, Ticket-Link. **Kein Nachrichtentext, keine
 * E-Mail-Adresse, kein Name des Gastgebers.** Wer das ändert, ändert eine
 * Zusage im Datenschutz.
 *
 * Der JWT trägt nur das Objekt, nicht die Klasse: Googles Obergrenze für den
 * kodierten Token liegt bei 2048 Zeichen, und mit eingebetteter Klasse wird
 * das bei langen Texten knapp. Die Klasse legt `scripts/create-google-class.mjs`
 * einmalig an.
 */

/** Wie lange der Pass nach dem Termin noch gültig aussieht. */
const GRACE_MINUTES = 6 * 60

/**
 * Googles Obergrenze für den kodierten Token. Gemessen liegt ein Ticket bei
 * rund 1650 Zeichen, mit den längsten erlaubten Texten (Anlass 60, eigener
 * Vorschlag 40) bei knapp 1800 — Reserve genug, aber nicht beliebig viel.
 * Wer die Felder oben erweitert, soll hier auflaufen und nicht stumm bei
 * Google, wo sich ein zu langer Link ohne Fehlermeldung verliert.
 */
const JWT_MAX = 2048

export function saveUrl(ticket: SavedTicket, token: string): string {
  const jwt = signJwt(claims(ticket, token))
  if (jwt.length > JWT_MAX) {
    throw new Error(`Google-Wallet-JWT zu lang: ${jwt.length} > ${JWT_MAX} Zeichen`)
  }
  return `https://pay.google.com/gp/v/save/${jwt}`
}

export function classId(): string {
  return `${env.googleWalletIssuerId}.${env.googleWalletClassSuffix}`
}

function claims(ticket: SavedTicket, token: string): object {
  return {
    iss: env.googleWalletClientEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor(Date.now() / 1000),
    origins: [env.siteUrl],
    payload: { eventTicketObjects: [eventTicketObject(ticket, token)] },
  }
}

function eventTicketObject(ticket: SavedTicket, token: string) {
  const { data } = ticket
  const url = ticketUrl(token)
  const start = new Date(data.startsAt)
  const end = new Date(start.getTime() + (data.durationMin + GRACE_MINUTES) * 60_000)

  return {
    id: `${env.googleWalletIssuerId}.${objectSuffix(token)}`,
    classId: classId(),
    state: 'ACTIVE',
    // Nur der Vorname. Der volle Name stünde sonst dauerhaft bei Google.
    ticketHolderName: data.recipientName.split(' ')[0],
    barcode: { type: 'QR_CODE', value: url, alternateText: data.slug },
    // Nach diesem Zeitpunkt rutscht der Pass von selbst zu den abgelaufenen.
    validTimeInterval: {
      start: { date: start.toISOString() },
      end: { date: end.toISOString() },
    },
    // Der Anlass steht hier und nicht als `eventName`: das liegt auf der
    // Klasse und ist damit für alle Tickets gleich.
    textModulesData: [
      { id: 'was', header: 'Was', body: data.optionLabel },
      {
        id: 'wann',
        header: 'Wann',
        body: `${formatDateTime(data.startsAt, data.timezone)} (${data.timezone})`,
      },
      { id: 'dauer', header: 'Dauer', body: `ca. ${formatDuration(data.durationMin)}` },
    ],
    linksModuleData: { uris: [{ uri: url, description: 'Dein Ticket' }] },
    hexBackgroundColor: '#0a0d13',
  }
}

/**
 * Die Objekt-Kennung, wie die Apple-Seriennummer: deterministisch, damit ein
 * zweiter Klick dieselbe Karte aktualisiert, und mit eigenem Präfix, damit sie
 * nicht der in der Datenbank stehende `ticket_token_hash` ist. Base64url
 * liefert nur `A-Za-z0-9-_` — alles davon erlaubt Google in einer ID.
 */
function objectSuffix(token: string): string {
  return createHash('sha256')
    .update(`voulez:gwallet:v1:${token}`)
    .digest('base64url')
    .slice(0, 22)
}

/**
 * RS256 von Hand. Das ist RSASSA-PKCS1-v1_5 über SHA-256 — genau das, was
 * `createSign('RSA-SHA256')` liefert. Kein Umpacken von `(r,s)` nötig, das
 * wäre erst bei ES256 ein Thema. Deshalb keine JWT-Bibliothek.
 */
function signJwt(payload: object): string {
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = b64u(JSON.stringify(payload))
  const signature = createSign('RSA-SHA256')
    .update(`${head}.${body}`)
    .end()
    .sign(env.googleWalletPrivateKey)
    .toString('base64url')
  return `${head}.${body}.${signature}`
}

function b64u(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

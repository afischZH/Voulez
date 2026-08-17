/**
 * Legt die EventTicketClass für Google Wallet an — einmalig, von Hand.
 *
 *   node --env-file=.env.local scripts/create-google-class.mjs
 *
 * Warum ein Skript und nicht ein paar Klicks in der Wallet-Konsole: so steht
 * die Klassendefinition als prüfbarer Text im Repo. Wer sie ändern will, sieht
 * im Diff, was sich ändert.
 *
 * Das Skript ist absichtlich idempotent — zweimal laufen lassen aktualisiert
 * die Klasse, statt einen Fehler zu werfen. Es gehört nicht ins Bündel für
 * Vercel und wird zur Laufzeit nie aufgerufen.
 */
import { createSign } from 'node:crypto'

const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer'
const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const API = 'https://walletobjects.googleapis.com/walletobjects/v1/eventTicketClass'

function required(name) {
  const value = process.env[name]?.trim()
  if (!value) {
    console.error(
      `Umgebungsvariable ${name} fehlt. Siehe .env.example — und nicht vergessen:\n` +
        '  node --env-file=.env.local scripts/create-google-class.mjs',
    )
    process.exit(1)
  }
  return value
}

const issuerId = required('GOOGLE_WALLET_ISSUER_ID')
const clientEmail = required('GOOGLE_WALLET_CLIENT_EMAIL')
const privateKey = required('GOOGLE_WALLET_PRIVATE_KEY').replace(/\\n/g, '\n')
const suffix = process.env.GOOGLE_WALLET_CLASS_SUFFIX?.trim() || 'voulez_einladung_v1'
const siteUrl = (process.env.SITE_URL ?? 'https://voulez.love').replace(/\/$/, '')

const b64u = (value) => Buffer.from(value, 'utf8').toString('base64url')

function signJwt(payload) {
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const body = b64u(JSON.stringify(payload))
  const signature = createSign('RSA-SHA256')
    .update(`${head}.${body}`)
    .end()
    .sign(privateKey)
    .toString('base64url')
  return `${head}.${body}.${signature}`
}

/** Service-Account-Grant: eigener JWT gegen ein kurzlebiges Zugriffstoken. */
async function accessToken() {
  const now = Math.floor(Date.now() / 1000)
  const assertion = signJwt({
    iss: clientEmail,
    scope: SCOPE,
    aud: TOKEN_URL,
    iat: now,
    exp: now + 3600,
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  })

  const json = await response.json()
  if (!response.ok) {
    throw new Error(`Zugriffstoken abgelehnt (${response.status}): ${JSON.stringify(json)}`)
  }
  return json.access_token
}

const id = `${issuerId}.${suffix}`

const eventTicketClass = {
  id,
  issuerName: 'Voulez',
  // Steht im Kopf jedes Passes. Der eigentliche Anlass variiert pro Ticket und
  // liegt deshalb im Objekt, in `textModulesData`.
  eventName: { defaultValue: { language: 'de-CH', value: 'Einladung' } },
  reviewStatus: 'UNDER_REVIEW',
  hexBackgroundColor: '#0a0d13',
  countryCode: 'CH',
  homepageUri: { uri: siteUrl, description: 'voulez.love' },
  // Ein Ticket, ein Mensch — aber auf allen seinen Geräten.
  multipleDevicesAndHoldersAllowedStatus: 'ONE_USER_ALL_DEVICES',
}

const token = await accessToken()
const headers = {
  authorization: `Bearer ${token}`,
  'content-type': 'application/json',
}

const existing = await fetch(`${API}/${encodeURIComponent(id)}`, { headers })

const response =
  existing.status === 404
    ? await fetch(API, { method: 'POST', headers, body: JSON.stringify(eventTicketClass) })
    : await fetch(`${API}/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers,
        body: JSON.stringify(eventTicketClass),
      })

const body = await response.json()
if (!response.ok) {
  console.error(`Klasse abgelehnt (${response.status}):`, JSON.stringify(body, null, 2))
  if (response.status === 403) {
    console.error(
      '\n403 heisst meist: der Service-Account steht nicht als Nutzer in der\n' +
        'Wallet-Konsole. Google Wallet API → Users → Adresse mit Rolle „Developer".',
    )
  }
  process.exit(1)
}

console.log(existing.status === 404 ? 'Klasse angelegt:' : 'Klasse aktualisiert:', body.id)

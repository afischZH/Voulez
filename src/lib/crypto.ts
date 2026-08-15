import 'server-only'

import { randomBytes, scrypt as scryptCb, createHash, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number; maxmem: number },
) => Promise<Buffer>

// Bewusst teuer. Eine PIN hat nur 10^4 bis 10^6 Möglichkeiten — falls die
// Datenbank je abhandenkommt, ist der Hash allein kein Schutz. Der echte
// Schutz ist das Rate-Limit in rate-limit.ts; das hier verhindert nur, dass
// ein DB-Dump sofort alle PINs im Klartext liefert.
const SCRYPT = { N: 2 ** 15, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const
const KEYLEN = 32

/** Erzeugt `scrypt$N$r$p$salt$hash`, alles base64url. */
export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scrypt(pin.normalize('NFKC'), salt, KEYLEN, SCRYPT)
  return [
    'scrypt',
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const parts = stored.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false

  const [, n, r, p, saltB64, hashB64] = parts
  const salt = Buffer.from(saltB64, 'base64url')
  const expected = Buffer.from(hashB64, 'base64url')

  let actual: Buffer
  try {
    actual = await scrypt(pin.normalize('NFKC'), salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    })
  } catch {
    return false
  }

  return actual.length === expected.length && timingSafeEqual(actual, expected)
}

/**
 * Rätsel-Antworten sind kurze Freitexte. Sie werden nur serverseitig
 * verglichen, deshalb reicht ein normalisierter Vergleich in konstanter Zeit.
 */
export function answersMatch(given: string, expected: string): boolean {
  const a = Buffer.from(normalizeAnswer(given))
  const b = Buffer.from(normalizeAnswer(expected))
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** Groß/klein, Akzente, Satzzeichen und Mehrfach-Leerzeichen sind egal. */
export function normalizeAnswer(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9ß ]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** 32 Byte Zufall für Bearbeiten- und Bestätigungs-Links. */
export function newToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Tokens sind bereits hochentropisch — SHA-256 genügt, kein KDF nötig. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function tokenMatches(token: string, storedHash: string): boolean {
  const a = Buffer.from(hashToken(token), 'hex')
  const b = Buffer.from(storedHash, 'hex')
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

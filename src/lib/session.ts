import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'
import { cookies } from 'next/headers'
import { env } from '@/lib/env'

/**
 * Nachweis, dass dieser Besucher den Tresor tatsächlich geöffnet hat.
 *
 * Ohne diesen Nachweis könnte man den Antwort-Endpunkt direkt aufrufen und
 * die PIN überspringen. Der Token ist ein HMAC über Tresor-ID und Ablauf und
 * liegt in einem HttpOnly-Cookie — der Browser kann ihn weder lesen noch
 * fälschen.
 */
const TTL_SECONDS = 60 * 60 * 6

function sign(payload: string): string {
  return createHmac('sha256', env.sessionSecret).update(payload).digest('base64url')
}

function cookieName(slug: string): string {
  return `voulez_open_${slug}`
}

export async function grantUnlocked(slug: string, vaultId: string): Promise<void> {
  const expires = Math.floor(Date.now() / 1000) + TTL_SECONDS
  const payload = `${vaultId}.${expires}`
  const token = `${payload}.${sign(payload)}`

  const store = await cookies()
  store.set(cookieName(slug), token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: TTL_SECONDS,
  })
}

export async function hasUnlocked(slug: string, vaultId: string): Promise<boolean> {
  const store = await cookies()
  const token = store.get(cookieName(slug))?.value
  if (!token) return false

  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [id, expires, signature] = parts
  if (id !== vaultId) return false
  if (Number(expires) * 1000 < Date.now()) return false

  const expected = Buffer.from(sign(`${id}.${expires}`))
  const actual = Buffer.from(signature)
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

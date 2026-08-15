import 'server-only'

import { NextResponse } from 'next/server'

/**
 * Antworten der Tresor-Endpunkte dürfen nie in einem Cache landen —
 * weder im Browser noch auf der CDN-Ebene.
 */
const NO_STORE = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
} as const

export function ok<T extends object>(body: T) {
  return NextResponse.json(body, { headers: NO_STORE })
}

export function fail(status: number, code: string, message: string, extra?: object) {
  return NextResponse.json(
    { error: code, message, ...extra },
    { status, headers: NO_STORE },
  )
}

export const errors = {
  notFound: () => fail(404, 'not_found', 'Diesen Tresor gibt es nicht.'),
  gone: () => fail(410, 'gone', 'Dieser Tresor ist abgelaufen.'),
  badRequest: (message = 'Die Anfrage war unvollständig.') =>
    fail(400, 'bad_request', message),
  tooMany: (retryAfterSeconds: number) =>
    fail(429, 'too_many', 'Zu viele Versuche. Kurz durchatmen.', {
      retryAfterSeconds,
    }),
  locked: (until: string) =>
    fail(423, 'locked', 'Der Tresor hat sich vorübergehend verriegelt.', { until }),
}

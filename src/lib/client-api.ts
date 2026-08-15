import type { OpenedVault } from '@/lib/vault'

export type PuzzleResult =
  | { correct: true; position: number; digit: string }
  | { correct: false; feedback: unknown }

/** Mastermind-Rückmeldung: richtig platziert / enthalten, aber falsch platziert. */
export type NumberFeedback = { exact: number; misplaced: number }

/** Wordle-Rückmeldung: pro Buchstabe eine Markierung. */
export type WordFeedback = { marks: string[]; lengthMismatch: boolean }

export type UnlockResult =
  | { opened: true; vault: OpenedVault }
  | { opened: false }
  | { locked: true; until: string }
  | { throttled: true; retryAfterSeconds: number }

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return { res, json: await res.json().catch(() => ({})) }
}

export async function checkPuzzle(
  slug: string,
  puzzleId: string,
  attempt: unknown,
): Promise<PuzzleResult> {
  const { res, json } = await post(
    `/api/v/${encodeURIComponent(slug)}/puzzles/${encodeURIComponent(puzzleId)}`,
    { attempt },
  )
  if (!res.ok) return { correct: false, feedback: null }
  return json as PuzzleResult
}

/** Deckt eine einzelne Memory-Karte auf. Das Kartenbild bleibt auf dem Server. */
export async function peekCard(
  slug: string,
  puzzleId: string,
  index: number,
): Promise<string | null> {
  const { res, json } = await post(
    `/api/v/${encodeURIComponent(slug)}/puzzles/${encodeURIComponent(puzzleId)}`,
    { peek: index },
  )
  return res.ok && typeof json.value === 'string' ? json.value : null
}

/** Notausgang nach drei Fehlversuchen. Gibt die Ziffer oder null zurück. */
export async function surrenderPuzzle(
  slug: string,
  puzzleId: string,
): Promise<string | null> {
  const { res, json } = await post(
    `/api/v/${encodeURIComponent(slug)}/puzzles/${encodeURIComponent(puzzleId)}/surrender`,
    {},
  )
  return res.ok ? String(json.digit) : null
}

export async function unlockVault(slug: string, pin: string): Promise<UnlockResult> {
  const { res, json } = await post(`/api/v/${encodeURIComponent(slug)}/unlock`, { pin })

  if (res.status === 423) return { locked: true, until: String(json.until ?? '') }
  if (res.status === 429)
    return { throttled: true, retryAfterSeconds: Number(json.retryAfterSeconds ?? 300) }
  if (!res.ok) return { opened: false }

  return json as UnlockResult
}

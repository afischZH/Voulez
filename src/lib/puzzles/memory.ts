import 'server-only'

import { createHash, createHmac } from 'node:crypto'
import { z } from 'zod'
import { env } from '@/lib/env'
import type { PuzzleContext, PuzzleDefinition } from '@/lib/puzzles/contract'

const configSchema = z.object({
  symbols: z.array(z.string().min(1).max(8)).min(3).max(8),
})

const attemptSchema = z.object({
  /** Alle gefundenen Paare als Kartenindizes. */
  pairs: z.array(z.tuple([z.number().int().min(0), z.number().int().min(0)])).max(8),
})

export type MemoryConfig = z.infer<typeof configSchema>
export type MemoryAttempt = z.infer<typeof attemptSchema>

/**
 * Deterministischer Schlüsselstrom aus dem Server-Secret. Dieselbe Karte
 * liegt bei jedem Aufruf an derselben Stelle, ohne dass irgendwo ein
 * Spielzustand gespeichert werden muss.
 */
function keystream(seed: Buffer, bytes: number): Buffer {
  const chunks: Buffer[] = []
  let filled = 0
  for (let counter = 0; filled < bytes; counter += 1) {
    const block = createHash('sha256')
      .update(seed)
      .update(Buffer.from([counter]))
      .digest()
    chunks.push(block)
    filled += block.length
  }
  return Buffer.concat(chunks).subarray(0, bytes)
}

/** Das Kartenbild — existiert nur auf dem Server. */
function board(config: MemoryConfig, context: PuzzleContext): string[] {
  const cards = [...config.symbols, ...config.symbols]
  const seed = createHmac('sha256', env.sessionSecret)
    .update(`memory:${context.puzzleId}`)
    .digest()
  const random = keystream(seed, cards.length * 4)

  for (let i = cards.length - 1; i > 0; i -= 1) {
    const pick = random.readUInt32BE((i - 1) * 4) % (i + 1)
    ;[cards[i], cards[pick]] = [cards[pick], cards[i]]
  }
  return cards
}

/**
 * Memory, ohne dass das Kartenbild im DOM liegt.
 *
 * Der naive Weg — Karten an den Client schicken und ihm glauben, wenn er
 * "fertig" meldet — wäre in den DevTools sofort zu sehen und per Direktaufruf
 * zu fälschen. Stattdessen fragt der Client jede Karte einzeln nach (`peek`)
 * und weist am Ende alle gefundenen Paare vor. Der Server prüft sie gegen ein
 * Kartenbild, das er jederzeit neu berechnen kann, aber nie speichert.
 */
export const memory: PuzzleDefinition<MemoryConfig, MemoryAttempt> = {
  kind: 'memory',
  configSchema,
  attemptSchema,

  toPlayerConfig(config) {
    return { cardCount: config.symbols.length * 2 }
  },

  peek(config, index, context) {
    const cards = board(config, context)
    return index >= 0 && index < cards.length ? cards[index] : null
  },

  verify(config, attempt, context) {
    const cards = board(config, context)
    if (attempt.pairs.length !== config.symbols.length) return false

    const seen = new Set<number>()
    for (const [a, b] of attempt.pairs) {
      if (a === b) return false
      if (a >= cards.length || b >= cards.length) return false
      if (seen.has(a) || seen.has(b)) return false
      if (cards[a] !== cards[b]) return false
      seen.add(a)
      seen.add(b)
    }
    return seen.size === cards.length
  },
}

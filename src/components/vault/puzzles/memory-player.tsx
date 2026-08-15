'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { peekCard, type PuzzleResult } from '@/lib/client-api'
import type { PlayerConfig } from '@/lib/puzzles/contract'

type Props = {
  slug: string
  puzzleId: string
  config: PlayerConfig
  busy: boolean
  onAttempt: (attempt: { pairs: [number, number][] }) => Promise<PuzzleResult>
}

export function MemoryPlayer({ slug, puzzleId, config, busy, onAttempt }: Props) {
  const cardCount = Number(config.cardCount ?? 8)
  const still = useReducedMotion()

  // Symbole kommen einzeln vom Server nach — das Kartenbild liegt nie
  // vollständig im Browser, sonst wäre das Rätsel in den DevTools gelöst.
  const [faces, setFaces] = useState<Record<number, string>>({})
  const [flipped, setFlipped] = useState<number[]>([])
  const [matched, setMatched] = useState<number[]>([])
  const [pairs, setPairs] = useState<[number, number][]>([])
  // Während eine Karte beim Server angefragt wird, werden weitere Klicks
  // ignoriert. Ohne sichtbaren Zustand wirkt das auf langsamer Leitung kaputt.
  const [peekingIndex, setPeekingIndex] = useState<number | null>(null)
  const peeking = peekingIndex !== null

  const columns = cardCount <= 8 ? 4 : cardCount <= 12 ? 4 : 5

  async function flip(index: number) {
    if (busy || peeking) return
    if (matched.includes(index) || flipped.includes(index)) return
    if (flipped.length === 2) return

    setPeekingIndex(index)
    const face = await peekCard(slug, puzzleId, index)
    setPeekingIndex(null)
    if (!face) return

    setFaces((prev) => ({ ...prev, [index]: face }))
    const next = [...flipped, index]
    setFlipped(next)
    if (next.length < 2) return

    // `faces[a]` steht seit dem ersten Aufdecken fest, `face` kommt gerade
    // frisch vom Server.
    const [a, b] = next
    if (faces[a] === face) {
      const found: [number, number][] = [...pairs, [a, b]]
      setMatched((prev) => [...prev, a, b])
      setPairs(found)
      setFlipped([])

      if (found.length * 2 === cardCount) await onAttempt({ pairs: found })
    } else {
      // Kurz offen lassen, damit man sich die Karten merken kann.
      setTimeout(() => setFlipped([]), still ? 350 : 900)
    }
  }

  return (
    <div>
      <p className="text-parchment text-lg text-balance">
        Finde alle Paare. {pairs.length} von {cardCount / 2} gefunden.
      </p>

      {/* Ohne perspective spiegelt rotateY die Karte nur, statt sie zu drehen. */}
      <ul
        className="mt-5 grid gap-2.5"
        style={{
          gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
          perspective: '700px',
        }}
      >
        {Array.from({ length: cardCount }, (_, index) => {
          const isOpen = flipped.includes(index) || matched.includes(index)
          const isMatched = matched.includes(index)
          return (
            <li key={index}>
              <motion.button
                type="button"
                onClick={() => void flip(index)}
                disabled={busy || isMatched}
                aria-label={
                  isOpen
                    ? `Karte ${index + 1}: ${faces[index]}`
                    : `Karte ${index + 1}, verdeckt`
                }
                animate={{ rotateY: isOpen && !still ? 180 : 0 }}
                transition={{ duration: still ? 0 : 0.35 }}
                className={`flex aspect-square w-full items-center justify-center rounded-xl border text-2xl transition-colors ${
                  isMatched
                    ? 'border-brass/60 bg-brass/12'
                    : isOpen
                      ? 'border-brass/40 bg-steel-800'
                      : peekingIndex === index
                        ? 'border-brass/70 bg-steel-800 animate-pulse'
                        : 'brushed border-steel-600/70 hover:border-brass/50'
                }`}
              >
                <span
                  style={{ transform: isOpen && !still ? 'rotateY(180deg)' : undefined }}
                >
                  {isOpen ? faces[index] : ''}
                </span>
              </motion.button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

'use client'

import { MotionConfig } from 'motion/react'

/**
 * Die CSS-Regel für `prefers-reduced-motion` in globals.css greift nur bei
 * CSS-Animationen. Alles, was Motion in JavaScript animiert — Tür, Karten,
 * Etappenwechsel — braucht diesen Schalter, sonst dreht sich der Tresor
 * weiter, obwohl das System ausdrücklich das Gegenteil verlangt.
 */
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>
}

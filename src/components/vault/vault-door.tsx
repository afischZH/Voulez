'use client'

import { motion, useReducedMotion } from 'motion/react'

type Props = {
  recipientName: string
  /** 0…1 — wie viel der Kombination schon gefunden ist */
  progress: number
  state: 'closed' | 'shaking' | 'opening' | 'open'
  children?: React.ReactNode
}

const BOLTS = 12

/**
 * Die Tresortür. Sie ist die Bühne für alles andere: davor stehen die
 * Rätsel, dahinter liegt die Einladung.
 */
export function VaultDoor({ recipientName, progress, state, children }: Props) {
  const still = useReducedMotion()

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[min(88vw,30rem)]">
      {/* Warmes Licht, das mit dem Fortschritt kräftiger wird */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-[18%] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, var(--color-brass) 0%, transparent 62%)',
        }}
        animate={{ opacity: state === 'open' ? 0.5 : 0.08 + progress * 0.16 }}
        transition={{ duration: still ? 0 : 0.9, ease: [0.16, 1, 0.3, 1] }}
      />

      <motion.div
        className="brushed ring-steel-600/70 relative h-full w-full rounded-full ring-1"
        style={{
          boxShadow:
            '0 40px 90px -30px rgb(0 0 0 / 0.9), inset 0 2px 3px rgb(255 255 255 / 0.06), inset 0 -18px 40px rgb(0 0 0 / 0.55)',
        }}
        animate={
          state === 'shaking' && !still
            ? { x: [0, -9, 8, -6, 4, 0] }
            : state === 'opening' || state === 'open'
              ? { rotate: still ? 0 : -22, scale: 1.06, opacity: 0 }
              : { x: 0, rotate: 0, scale: 1, opacity: 1 }
        }
        transition={
          state === 'shaking'
            ? { duration: 0.42 }
            : { duration: still ? 0.2 : 1.1, ease: [0.16, 1, 0.3, 1] }
        }
      >
        {/* Riegelbolzen am Rand */}
        {Array.from({ length: BOLTS }, (_, i) => {
          const angle = (i / BOLTS) * 360
          const seated = i / BOLTS < progress
          // Der Ring dreht sich, nicht der Bolzen: eine Prozent-Translation
          // würde sich auf die Bolzengrösse beziehen statt auf den Türradius.
          return (
            <span
              key={i}
              aria-hidden
              className="absolute inset-0"
              style={{ transform: `rotate(${angle}deg)` }}
            >
              <motion.span
                className="absolute top-[3.5%] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full"
                animate={{
                  backgroundColor: seated
                    ? 'var(--color-brass)'
                    : 'var(--color-steel-600)',
                  boxShadow: seated
                    ? '0 0 10px 1px color-mix(in oklab, var(--color-brass) 60%, transparent)'
                    : 'none',
                }}
                transition={{ duration: still ? 0 : 0.4 }}
              />
            </span>
          )
        })}

        {/* Innere Ringe */}
        <div className="ring-steel-600/50 absolute inset-[9%] rounded-full shadow-[inset_0_2px_10px_rgb(0_0_0/0.5)] ring-1" />
        <div className="ring-steel-700/60 absolute inset-[16%] rounded-full ring-1" />

        {/* Gravur */}
        <div className="absolute inset-x-[18%] top-[19%] text-center">
          <p className="font-display text-2xs text-brass-dim tracking-[0.42em] uppercase">
            Für
          </p>
          <p className="engraved font-display mt-1 text-xl leading-tight tracking-wide text-balance sm:text-2xl">
            {recipientName}
          </p>
        </div>

        {/* Drehknauf */}
        <motion.div
          aria-hidden
          className="absolute top-1/2 left-1/2 h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2"
          animate={{ rotate: still ? 0 : progress * 480 }}
          transition={{ type: 'spring', stiffness: 60, damping: 14 }}
        >
          <div className="from-brass-bright via-brass to-brass-dim relative h-full w-full rounded-full bg-gradient-to-br shadow-[0_10px_24px_-6px_rgb(0_0_0/0.8),inset_0_2px_2px_rgb(255_255_255/0.35)]">
            {[0, 60, 120].map((deg) => (
              <span
                key={deg}
                // Kein translate() im transform: Tailwind v4 zentriert bereits
                // über die CSS-translate-Property, sonst verschiebt es doppelt.
                className="bg-brass-shadow/45 absolute top-1/2 left-1/2 h-[86%] w-[9%] -translate-x-1/2 -translate-y-1/2 rounded-full"
                style={{ transform: `rotate(${deg}deg)` }}
              />
            ))}
            <span className="bg-steel-900 absolute top-1/2 left-1/2 h-[26%] w-[26%] -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[inset_0_2px_4px_rgb(0_0_0/0.8)]" />
          </div>
        </motion.div>
      </motion.div>

      {/* Was hinter der Tür liegt */}
      {children}
    </div>
  )
}

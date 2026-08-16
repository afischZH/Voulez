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
const RIVETS = 24
/** Scheiben, die zusammen die Türstärke ergeben — sichtbar erst beim Schwenk. */
const SLICES = 8

/**
 * Die Choreografie der Öffnung, in Sekunden ab dem Moment, in dem die PIN
 * stimmt. Sie steht hier, weil `vault-experience` denselben Takt braucht:
 * Kamerafahrt und Überblendung müssen auf denselben Schlag laufen.
 */
export const OPEN_CHOREO = {
  /** Das Schloss läuft frei, der Knauf dreht durch. */
  spin: 0.15,
  /** Die Riegel fahren ein, einer nach dem anderen. */
  bolts: 1.25,
  /** Der Spalt bricht auf, Licht kommt heraus. */
  crack: 2.35,
  /** Die Tür schwenkt. */
  swing: 2.6,
  /** Das Licht flutet den Raum. */
  flood: 3.5,
  /** Gesamtlänge bis zum Schnitt auf die Einladung. */
  total: 5,
} as const

/**
 * Die Tresortür. Sie ist die Bühne für alles andere: davor stehen die
 * Rätsel, dahinter liegt die Einladung.
 *
 * Der Aufbau ist bewusst räumlich — Rahmen in der Wand, dahinter die Höhle,
 * davor das Türblatt mit echter Stärke. Erst dadurch liest sich der Schwenk
 * als Tür und nicht als verschwindende Scheibe.
 */
export function VaultDoor({ recipientName, progress, state, children }: Props) {
  const still = useReducedMotion()
  const opening = state === 'opening' || state === 'open'
  /** Verzögerungen fallen bei `prefers-reduced-motion` komplett weg. */
  const at = (seconds: number) => (still ? 0 : seconds)

  return (
    <div
      // 82vw statt 88: der Rahmen steht 4.5% über die Tür hinaus und würde
      // sonst auf schmalen Geräten die Kante berühren.
      className="relative mx-auto aspect-square w-full max-w-[min(82vw,30rem)]"
      // Ohne Perspektive ist der Schwenk nur eine Stauchung.
      style={{ perspective: '1500px', perspectiveOrigin: '50% 45%' }}
    >
      {/* Warmes Licht, das mit dem Fortschritt kräftiger wird — und beim
          Öffnen den ganzen Raum ausleuchtet. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -inset-[20%] rounded-full blur-3xl"
        style={{
          background: 'radial-gradient(circle, var(--color-brass) 0%, transparent 62%)',
        }}
        animate={{
          opacity: opening ? 0.7 : 0.08 + progress * 0.16,
          scale: opening ? 1.2 : 1,
        }}
        transition={{
          duration: still ? 0 : 2,
          delay: at(opening ? OPEN_CHOREO.crack : 0),
          ease: [0.16, 1, 0.3, 1],
        }}
      />

      {/* Der Rahmen sitzt in der Wand und bleibt stehen, egal was die Tür tut. */}
      <div
        aria-hidden
        className="brushed ring-steel-700/80 absolute -inset-[4.5%] rounded-full ring-1"
        style={{
          boxShadow:
            '0 50px 110px -40px rgb(0 0 0 / 0.95), inset 0 2px 3px rgb(255 255 255 / 0.05), inset 0 -20px 44px rgb(0 0 0 / 0.6)',
        }}
      >
        {Array.from({ length: RIVETS }, (_, i) => (
          <span
            key={i}
            className="absolute inset-0"
            style={{ transform: `rotate(${(i / RIVETS) * 360}deg)` }}
          >
            <span className="bg-steel-500/55 absolute top-[1.2%] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full shadow-[inset_0_1px_1px_rgb(255_255_255/0.28)]" />
          </span>
        ))}
      </div>

      {/* Die Höhle. Sie liegt hinter der Tür und ist vor dem Öffnen schwarz. */}
      <div className="bg-ink-sunk absolute inset-0 overflow-hidden rounded-full shadow-[inset_0_0_70px_24px_rgb(0_0_0/0.95)]">
        <motion.div
          aria-hidden
          className="absolute inset-[-30%]"
          style={{
            background:
              'radial-gradient(circle at 50% 52%, var(--color-brass-bright) 0%, var(--color-brass) 20%, var(--color-brass-shadow) 44%, transparent 70%)',
          }}
          initial={false}
          animate={{ opacity: opening ? 0.92 : 0, scale: opening ? 1 : 0.3 }}
          transition={{
            duration: still ? 0.2 : 1.9,
            delay: at(OPEN_CHOREO.crack),
            ease: [0.16, 1, 0.3, 1],
          }}
        />

        {/* Staub im Lichtkegel — nur beim Öffnen, sonst wäre es Dekor. */}
        {opening &&
          !still &&
          Array.from({ length: 14 }, (_, i) => (
            <motion.span
              key={i}
              aria-hidden
              className="bg-brass-bright/70 absolute h-[3px] w-[3px] rounded-full"
              style={{
                left: `${12 + ((i * 37) % 76)}%`,
                top: `${18 + ((i * 53) % 64)}%`,
              }}
              initial={{ opacity: 0, scale: 0.4 }}
              animate={{
                opacity: [0, 0.9, 0],
                y: [0, -34 - (i % 5) * 9],
                scale: [0.4, 1],
              }}
              transition={{
                duration: 2.6 + (i % 4) * 0.5,
                delay: OPEN_CHOREO.flood + i * 0.11,
                ease: 'easeOut',
              }}
            />
          ))}

        {children}

        {/* Der Rand der Höhle bleibt dunkel — sonst liest sich das Licht als
            goldene Scheibe statt als Tiefe. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-full shadow-[inset_0_0_58px_26px_rgb(0_0_0/0.62)]"
        />
      </div>

      {/* Scharniere links — sie liegen hinter dem Türblatt und tragen es
          sichtbar, sobald es ausschwenkt. */}
      {[32, 68].map((top) => (
        <span
          key={top}
          aria-hidden
          className="bg-steel-700 ring-steel-600/60 absolute h-3.5 w-[13%] rounded-sm ring-1"
          style={{ top: `${top}%`, left: '1%' }}
        />
      ))}

      {/* Das Türblatt */}
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d', transformOrigin: '1% 50%' }}
        initial={false}
        animate={
          state === 'shaking' && !still
            ? { x: [0, -10, 9, -6, 4, 0], rotateY: 0, opacity: 1 }
            : opening
              ? still
                ? { opacity: 0 }
                : { rotateY: -108, x: -12, opacity: 1 }
              : { x: 0, rotateY: 0, opacity: 1 }
        }
        transition={
          state === 'shaking'
            ? { duration: 0.42 }
            : opening
              ? {
                  duration: still ? 0.2 : 2.2,
                  delay: at(OPEN_CHOREO.swing),
                  // Schwer anlaufen, weich auslaufen: die Tür hat Masse.
                  ease: [0.55, 0, 0.2, 1],
                }
              : { duration: still ? 0 : 0.6, ease: [0.16, 1, 0.3, 1] }
        }
      >
        {/* Türstärke: gestapelte Scheiben hinter der Front. */}
        {Array.from({ length: SLICES }, (_, i) => (
          <div
            key={i}
            aria-hidden
            className="absolute inset-0 rounded-full"
            style={{
              transform: `translateZ(${-5 * (i + 1)}px)`,
              background: `color-mix(in oklab, var(--color-steel-800) ${96 - i * 9}%, #000)`,
              boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.45)',
            }}
          />
        ))}

        {/* Front */}
        <div
          className="brushed ring-steel-600/70 absolute inset-0 rounded-full ring-1"
          style={{
            transform: 'translateZ(1px)',
            boxShadow:
              '0 40px 90px -30px rgb(0 0 0 / 0.9), inset 0 2px 3px rgb(255 255 255 / 0.07), inset 0 -18px 40px rgb(0 0 0 / 0.55)',
          }}
        >
          {/* Glanz aus der Lichtquelle oben links */}
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 rounded-full"
            style={{
              background:
                'radial-gradient(75% 60% at 26% 16%, rgb(255 255 255 / 0.09) 0%, transparent 62%)',
            }}
          />

          {/* Riegelbolzen am Rand — beim Öffnen fahren sie ein. */}
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
                  className="absolute top-[3%] left-1/2 h-3.5 w-2.5 -translate-x-1/2 rounded-full"
                  initial={false}
                  animate={{
                    // Positiv ist radial nach innen — der Wrapper ist mitgedreht.
                    y: opening && !still ? 22 : 0,
                    backgroundColor:
                      seated && !opening
                        ? 'var(--color-brass)'
                        : 'var(--color-steel-600)',
                    boxShadow:
                      seated && !opening
                        ? '0 0 10px 1px color-mix(in oklab, var(--color-brass) 60%, transparent)'
                        : '0 0 0 0 transparent',
                  }}
                  transition={{
                    duration: still ? 0 : opening ? 0.52 : 0.4,
                    delay: opening ? at(OPEN_CHOREO.bolts + i * 0.055) : 0,
                    ease: opening ? [0.36, 0, 0.66, -0.4] : 'easeOut',
                  }}
                />
              </span>
            )
          })}

          {/* Innere Ringe — der äussere zieht beim Entriegeln mit. */}
          <motion.div
            aria-hidden
            className="ring-steel-600/50 absolute inset-[9%] rounded-full shadow-[inset_0_2px_10px_rgb(0_0_0/0.5)] ring-1"
            initial={false}
            animate={{ rotate: opening && !still ? -30 : 0 }}
            transition={{
              duration: still ? 0 : 1.2,
              delay: at(OPEN_CHOREO.bolts),
              ease: [0.34, 1.56, 0.64, 1],
            }}
          />
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
            initial={false}
            animate={{
              rotate: still ? 0 : progress * 480 + (opening ? 1140 : 0),
            }}
            transition={
              opening
                ? {
                    duration: still ? 0 : 2.5,
                    delay: at(OPEN_CHOREO.spin),
                    ease: [0.3, 0, 0.15, 1],
                  }
                : { type: 'spring', stiffness: 60, damping: 14 }
            }
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
        </div>
      </motion.div>

      {/* Der Spalt: ein kurzer Lichtblitz genau auf der Türkante, in dem
          Moment, in dem die Dichtung bricht. Liegt über allem. */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full"
        style={{
          boxShadow:
            '0 0 46px 8px var(--color-brass-bright), inset 0 0 34px 6px var(--color-brass)',
        }}
        initial={false}
        animate={{ opacity: opening && !still ? [0, 1, 0.35, 0] : 0 }}
        transition={{
          duration: still ? 0 : 1.5,
          delay: at(OPEN_CHOREO.crack),
          times: [0, 0.14, 0.45, 1],
          ease: 'easeOut',
        }}
      />
    </div>
  )
}

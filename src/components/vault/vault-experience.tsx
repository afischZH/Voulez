'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { DigitTray } from '@/components/vault/digit-tray'
import { PinPad } from '@/components/vault/pin-pad'
import { PuzzleHub } from '@/components/vault/puzzle-hub'
import { OPEN_CHOREO, VaultDoor } from '@/components/vault/vault-door'
import { InvitationFlow } from '@/components/invitation/invitation-flow'
import { unlockVault } from '@/lib/client-api'
import type { LockedVault, OpenedVault } from '@/lib/vault'

type Stage = 'door' | 'puzzles' | 'keypad' | 'opening' | 'opened'

export function VaultExperience({ vault }: { vault: LockedVault }) {
  const still = useReducedMotion()
  const [stage, setStage] = useState<Stage>('door')
  const [solved, setSolved] = useState<Record<string, string>>({})
  const [digitByPosition, setDigitByPosition] = useState<Record<number, string>>({})
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [shaking, setShaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [opened, setOpened] = useState<OpenedVault | null>(null)

  // Jede Etappe fängt oben an — sonst landet man nach einem Wechsel
  // mitten im neuen Bild.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [stage])

  // Die Öffnung ist eine feste Sequenz — erst wenn sie durchgelaufen ist,
  // schneidet die Seite auf die Einladung.
  useEffect(() => {
    if (stage !== 'opening') return
    const timer = setTimeout(
      () => setStage('opened'),
      still ? 500 : OPEN_CHOREO.total * 1000,
    )
    return () => clearTimeout(timer)
  }, [stage, still])

  const solvedCount = Object.keys(solved).length
  const rawProgress = vault.puzzles.length
    ? solvedCount / vault.puzzles.length
    : stage === 'door'
      ? 0
      : 1
  // Im Moment des Öffnens sitzt jeder Riegel — egal, wie viele Rätsel man
  // übersprungen hat.
  const progress = stage === 'opening' ? 1 : rawProgress

  const trayDigits = useMemo(
    () =>
      vault.puzzles
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((p) => digitByPosition[p.position] ?? null),
    [digitByPosition, vault.puzzles],
  )

  async function submitPin() {
    setBusy(true)
    setError(null)
    const result = await unlockVault(vault.slug, pin)
    setBusy(false)

    if ('opened' in result && result.opened) {
      setOpened(result.vault)
      setStage('opening')
      return
    }

    if ('locked' in result) {
      const until = new Date(result.until)
      setError(
        `Der Tresor hat sich verriegelt. Wieder frei um ${until.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}.`,
      )
    } else if ('throttled' in result) {
      setError('Zu viele Versuche. Warte einen Moment.')
    } else {
      setError('Diese Kombination stimmt nicht.')
    }

    setShaking(true)
    setPin('')
    setTimeout(() => setShaking(false), 450)
  }

  if (stage === 'opened' && opened) {
    return <InvitationFlow slug={vault.slug} vault={vault} opened={opened} emerge />
  }

  return (
    // `m-auto` statt `justify-center`: zentriert genauso, macht aber den
    // oberen Teil erreichbar, sobald der Inhalt höher wird als das Fenster.
    <main className="flex flex-1 flex-col items-center px-5 py-12">
      <div className="my-auto flex w-full flex-col items-center">
        <AnimatePresence mode="wait">
          {stage === 'door' && (
            <motion.div
              key="door"
              className="flex w-full flex-col items-center gap-9"
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            >
              <VaultDoor
                recipientName={vault.recipientName}
                progress={progress}
                state="closed"
              />

              {vault.introText && (
                <p className="text-fog max-w-md text-center text-lg text-balance">
                  {vault.introText}
                </p>
              )}

              <button
                type="button"
                onClick={() => setStage(vault.puzzles.length ? 'puzzles' : 'keypad')}
                className="border-brass bg-brass/16 text-brass-bright hover:bg-brass/26 rounded-lg border px-7 py-3.5 transition-all hover:-translate-y-0.5"
              >
                {vault.puzzles.length ? 'Kombination suchen' : 'Tresor öffnen'}
              </button>
            </motion.div>
          )}

          {stage === 'puzzles' && (
            <motion.div
              key="puzzles"
              className="flex w-full flex-col items-center gap-9"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <PuzzleHub
                slug={vault.slug}
                puzzles={vault.puzzles}
                solved={solved}
                onSolved={(puzzleId, position, digit) => {
                  setSolved((prev) => ({ ...prev, [puzzleId]: digit }))
                  setDigitByPosition((prev) => ({ ...prev, [position]: digit }))
                }}
                onDone={() => setStage('keypad')}
              />
              <DigitTray length={vault.puzzles.length} digits={trayDigits} />
            </motion.div>
          )}

          {/* Keypad und Öffnung teilen sich einen Key: es ist dieselbe Tür,
              an der man eben noch gedreht hat. Ein Neu-Mounten würde den
              Schnitt kaputt machen. */}
          {(stage === 'keypad' || stage === 'opening') && (
            <motion.div
              key="keypad"
              className="flex w-full flex-col items-center gap-8"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              {/* Kamerafahrt: langsam an, dann in die Höhle hinein. */}
              <motion.div
                className="w-full max-w-sm"
                initial={false}
                animate={
                  stage === 'opening' && !still
                    ? { scale: [1, 1.04, 1.14, 1.95], y: [0, 0, 8, 52] }
                    : { scale: 1, y: 0 }
                }
                transition={
                  stage === 'opening'
                    ? {
                        duration: still ? 0 : OPEN_CHOREO.total,
                        // Lange ruhig stehen, erst mit dem Schwenk hineinfahren.
                        times: [0, 0.44, 0.66, 1],
                        ease: [0.6, 0, 0.35, 1],
                      }
                    : { duration: still ? 0 : 0.4 }
                }
              >
                <VaultDoor
                  recipientName={vault.recipientName}
                  progress={progress}
                  state={stage === 'opening' ? 'opening' : shaking ? 'shaking' : 'closed'}
                />
              </motion.div>

              <motion.div
                className="flex w-full flex-col items-center gap-8"
                aria-hidden={stage === 'opening'}
                initial={false}
                animate={{
                  opacity: stage === 'opening' ? 0 : 1,
                  y: stage === 'opening' ? 18 : 0,
                }}
                transition={{ duration: still ? 0 : 0.45, ease: [0.16, 1, 0.3, 1] }}
                style={{ pointerEvents: stage === 'opening' ? 'none' : 'auto' }}
              >
                <PinPad
                  length={vault.pinLength}
                  value={pin}
                  onChange={(next) => {
                    setPin(next)
                    setError(null)
                  }}
                  onSubmit={submitPin}
                  disabled={busy || stage === 'opening'}
                  error={error}
                />

                {vault.puzzles.length > 0 && (
                  <>
                    <DigitTray length={vault.puzzles.length} digits={trayDigits} />
                    <button
                      type="button"
                      onClick={() => setStage('puzzles')}
                      className="text-fog hover:text-brass text-sm underline underline-offset-4 transition-colors"
                    >
                      Zurück zu den Rätseln
                    </button>
                  </>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {stage === 'opening' && (
        <>
          <p className="sr-only" role="status">
            Die Kombination stimmt. Der Tresor öffnet sich.
          </p>
          {/* Das Licht aus der Höhle nimmt den Raum ein und wird zum Schnitt
              auf die Einladung — dort blendet es wieder auf. */}
          <motion.div
            aria-hidden
            className="pointer-events-none fixed inset-0 z-50"
            style={{
              background:
                'radial-gradient(circle at 50% 44%, var(--color-brass-bright) 0%, var(--color-brass) 30%, var(--color-brass-shadow) 58%, var(--color-ink) 82%)',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: still ? 0 : [0, 0, 0.16, 1] }}
            transition={{
              duration: still ? 0 : OPEN_CHOREO.total,
              times: [0, 0.68, 0.84, 1],
              ease: 'easeIn',
            }}
          />
        </>
      )}
    </main>
  )
}

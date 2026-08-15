'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { DigitTray } from '@/components/vault/digit-tray'
import { PinPad } from '@/components/vault/pin-pad'
import { PuzzleHub } from '@/components/vault/puzzle-hub'
import { VaultDoor } from '@/components/vault/vault-door'
import { InvitationFlow } from '@/components/invitation/invitation-flow'
import { unlockVault } from '@/lib/client-api'
import type { LockedVault, OpenedVault } from '@/lib/vault'

type Stage = 'door' | 'puzzles' | 'keypad' | 'opened'

export function VaultExperience({ vault }: { vault: LockedVault }) {
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

  const solvedCount = Object.keys(solved).length
  const progress = vault.puzzles.length
    ? solvedCount / vault.puzzles.length
    : stage === 'door'
      ? 0
      : 1

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
      setStage('opened')
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
    return <InvitationFlow slug={vault.slug} vault={vault} opened={opened} />
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

          {stage === 'keypad' && (
            <motion.div
              key="keypad"
              className="flex w-full flex-col items-center gap-8"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <div className="w-full max-w-sm">
                <VaultDoor
                  recipientName={vault.recipientName}
                  progress={progress}
                  state={shaking ? 'shaking' : 'closed'}
                />
              </div>

              <PinPad
                length={vault.pinLength}
                value={pin}
                onChange={(next) => {
                  setPin(next)
                  setError(null)
                }}
                onSubmit={submitPin}
                disabled={busy}
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
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

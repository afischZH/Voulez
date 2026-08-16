'use client'

import { useRef, type PointerEvent } from 'react'
import { useReducedMotion } from 'motion/react'
import type { TicketData } from '@/components/invitation/ticket'
import { formatDuration } from '@/lib/time'

/**
 * Das Holo-Ticket ist der Moment, in dem die Zusage etwas wird, das man in
 * die Hand nehmen möchte: perforierte Karte, Abrisskante, Hologramm.
 *
 * Optik nach "Holographic Ticket" von dexter-st (uiverse.io, MIT). Die
 * Klassen liegen in `globals.css` — Masken, Blend-Modes und der SVG-Filter
 * lassen sich als Tailwind-Utilities nicht ausdrücken.
 *
 * Beim Zeigen kippt die Karte und das Hologramm wandert mit. Das ist der
 * ganze 3D-Effekt: er darf nichts kosten, wenn niemand hinzeigt.
 */
export function HoloTicket({ data }: { data: TicketData }) {
  const still = useReducedMotion()
  const tilt = useRef<HTMLDivElement>(null)

  function follow(event: PointerEvent<HTMLDivElement>) {
    // Nur Maus/Stift: auf dem Touchscreen liegt der Finger auf der Karte und
    // die Neigung würde bei jeder Berührung springen.
    if (still || event.pointerType === 'touch') return
    const node = tilt.current
    if (!node) return

    const box = node.getBoundingClientRect()
    const x = (event.clientX - box.left) / box.width - 0.5
    const y = (event.clientY - box.top) / box.height - 0.5

    node.style.transform = `rotateY(${x * 18}deg) rotateX(${-y * 14}deg)`
    // Der Lichtpunkt des Hologramms läuft der Neigung entgegen, wie bei einer
    // echten Folie.
    node.style.setProperty('--holo-x', `${60 - x * 70}%`)
    node.style.setProperty('--holo-y', `${50 - y * 60}%`)
  }

  function settle() {
    const node = tilt.current
    if (!node) return
    node.style.transform = ''
    node.style.removeProperty('--holo-x')
    node.style.removeProperty('--holo-y')
  }

  const when = new Date(data.startsAt)
  const day = new Intl.DateTimeFormat('de-CH', {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: data.timezone,
  }).format(when)
  const time = new Intl.DateTimeFormat('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: data.timezone,
  }).format(when)

  return (
    <div
      className="holo-stage print:hidden"
      onPointerMove={follow}
      onPointerLeave={settle}
    >
      <div ref={tilt} className="holo-tilt">
        <div className="holo-card">
          <div aria-hidden className="holo-notes">
            ✦ ✦ ✦ ✦
          </div>
          <div aria-hidden className="holo-notes">
            ✦ ✦ ✦
          </div>
          <div aria-hidden className="holo-notes">
            ✦ ✦ ✦ ✦
          </div>

          <div className="holo-header">
            TICKET
            <div aria-hidden className="holo-symbol">
              ✁
            </div>
          </div>

          <div className="holo-body">
            <em>{data.optionLabel}</em>
            <br />
            {day}
            <br />
            {time} Uhr · ca. {formatDuration(data.durationMin)}
            <br />
            {data.timezone}
            {data.hostName && (
              <>
                <br />
                mit {data.hostName}
              </>
            )}
          </div>

          <div className="holo-footer">
            <div className="holo-number">
              Für <span className="holo-bold">{data.recipientName}</span>
            </div>
            <div aria-hidden className="holo-barcode" />
            <div className="holo-code">{data.slug}</div>
          </div>

          <div aria-hidden className="holo-bg holo-sheen" />

          {/* Körnung: gibt der Fläche die Anmutung von Karton statt Bildschirm. */}
          <svg aria-hidden className="holo-filter">
            <filter id="holo-bump">
              <feTurbulence
                result="noise"
                numOctaves={3}
                baseFrequency={0.7}
                type="fractalNoise"
              />
              <feSpecularLighting
                in="noise"
                result="specular"
                lightingColor="#fffffc"
                specularExponent={25}
                specularConstant={0.8}
                surfaceScale={0.15}
              >
                <fePointLight z={210} y={100} x={100} />
              </feSpecularLighting>
              <feComposite
                result="noise2"
                operator="in"
                in="specular"
                in2="SourceGraphic"
              />
              <feBlend mode="screen" in2="noise2" in="SourceGraphic" />
            </filter>
          </svg>
        </div>
      </div>
    </div>
  )
}

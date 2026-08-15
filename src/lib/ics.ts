/**
 * Minimaler iCalendar-Export (RFC 5545). Eine Library wäre hier mehr
 * Abhängigkeit als Nutzen — ein VEVENT sind fünfzehn Zeilen.
 */
type Event = {
  uid: string
  start: Date
  /** Zeitpunkt der Zusage — bleibt stabil, damit ein erneuter Download
   *  denselben Termin aktualisiert statt einen zweiten anzulegen. */
  createdAt: Date
  durationMinutes: number
  title: string
  description?: string
  location?: string
  organizerEmail?: string
}

function stamp(date: Date): string {
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

/** Kommas, Semikolons, Backslashes und Zeilenumbrüche müssen escaped sein. */
function esc(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

/** Zeilen über 75 Oktette werden gefaltet, sonst lehnen manche Clients ab. */
function fold(line: string): string {
  if (line.length <= 75) return line
  const chunks: string[] = [line.slice(0, 75)]
  for (let i = 75; i < line.length; i += 74) chunks.push(' ' + line.slice(i, i + 74))
  return chunks.join('\r\n')
}

export function buildIcs(event: Event): string {
  const end = new Date(event.start.getTime() + event.durationMinutes * 60_000)

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Voulez//Einladung//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.uid}`,
    `DTSTAMP:${stamp(event.createdAt)}`,
    `DTSTART:${stamp(event.start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${esc(event.title)}`,
    event.description ? `DESCRIPTION:${esc(event.description)}` : null,
    event.location ? `LOCATION:${esc(event.location)}` : null,
    event.organizerEmail ? `ORGANIZER:mailto:${event.organizerEmail}` : null,
    'BEGIN:VALARM',
    'TRIGGER:-PT2H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Erinnerung',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((line): line is string => line !== null)

  return lines.map(fold).join('\r\n') + '\r\n'
}

/** Deep-Link in den Google-Kalender — für alle, die kein .ics anfassen wollen. */
export function googleCalendarUrl(event: Event): string {
  const end = new Date(event.start.getTime() + event.durationMinutes * 60_000)
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${stamp(event.start)}/${stamp(end)}`,
  })
  if (event.description) params.set('details', event.description)
  if (event.location) params.set('location', event.location)
  return `https://calendar.google.com/calendar/render?${params}`
}

/**
 * Zeitzonen ohne Library. Der Ersteller gibt Fenster in seiner Zeitzone an
 * ("Samstag 19:00"), gespeichert wird UTC. Ohne diese Umrechnung landet ein
 * Date im Sommer eine Stunde daneben — und ein Ticket mit falscher Uhrzeit
 * ist schlimmer als gar keins.
 */
function offsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at)

  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0)
  const asUtc = Date.UTC(
    get('year'),
    get('month') - 1,
    get('day'),
    get('hour') % 24,
    get('minute'),
    get('second'),
  )
  return asUtc - at.getTime()
}

/** `2026-09-12` + `19:30` in Europe/Zurich → korrekter UTC-Zeitpunkt. */
export function zonedToUtc(day: string, time: string, timeZone: string): Date {
  const [year, month, date] = day.split('-').map(Number)
  const [hour, minute] = time.split(':').map(Number)
  const naive = Date.UTC(year, month - 1, date, hour, minute)

  // Zweiter Durchgang, damit auch die Zeitumstellungs-Wochenenden stimmen.
  const first = naive - offsetMs(new Date(naive), timeZone)
  return new Date(naive - offsetMs(new Date(first), timeZone))
}

/** Halbstunden-Schritte innerhalb eines Fensters, `time_to` exklusiv. */
export function slotTimes(from: string, to: string, stepMinutes = 30): string[] {
  const toMinutes = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const times: string[] = []
  for (let m = toMinutes(from); m < toMinutes(to); m += stepMinutes) {
    times.push(
      `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`,
    )
  }
  return times
}

export function formatDay(day: string, timeZone: string): string {
  return new Intl.DateTimeFormat('de-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone,
  }).format(zonedToUtc(day, '12:00', timeZone))
}

/**
 * Dauer in Worten. Bewusst hier und nicht im Ticket: dieselbe Angabe steht
 * auf dem Bildschirm und in der Bestätigungsmail, und zwei Formatierungen
 * derselben Zahl fallen dem Empfänger sofort als Widerspruch auf.
 */
export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} Minuten`
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return rest ? `${hours} h ${rest} min` : `${hours} h`
}

export function formatDateTime(iso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('de-CH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(iso))
}

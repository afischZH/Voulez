import 'server-only'

import { env } from '@/lib/env'
import { deleteContact, PLUNK_API } from '@/lib/plunk'

type Attachment = {
  filename: string
  /** Inhalt als base64 — so verlangt es die Plunk-API. */
  content: string
  /** Plunk verlangt den Typ. Er ist auch sachlich nötig: ohne ihn raten
   *  Mail-Clients anhand der Endung und liegen bei .ics oft daneben
   *  (application/octet-stream statt text/calendar). */
  contentType: string
}

type Mail = {
  to: string
  subject: string
  text: string
  attachments?: Attachment[]
  /**
   * Den Kontakt, den Plunk beim Versand anlegt, danach wieder löschen.
   *
   * Plunk kennt keinen Versand ohne Kontakt: jede Empfängeradresse landet im
   * Adressbuch des Projekts und bliebe dort. Für Adressen, von denen wir
   * behaupten, sie nicht zu behalten — die des Besuchers beim Ticket — wäre
   * das eine stille Lüge.
   */
  forget?: boolean
}

/**
 * Warum kein `boolean`: ein blosses `false` beantwortet nicht die einzige
 * Frage, die im Fehlerfall zählt — liegt es am Betrieb (Key fehlt) oder am
 * Versand (Plunk lehnt ab)? Der Unterschied entscheidet, ob man eine
 * Umgebungsvariable nachtragen oder eine Adresse prüfen muss.
 */
export type SendResult =
  | { ok: true; id: string | null }
  | { ok: false; reason: 'not_configured' | 'rejected' | 'unreachable'; detail: string }

/** Genau einmal warnen, nicht bei jedem Aufruf dieselbe Zeile. */
let warnedMissingKey = false

/**
 * Plunk nimmt keinen RFC-5322-Absender („Voulez <post@voulez.love>"), sondern
 * Name und Adresse getrennt. `MAIL_FROM` bleibt trotzdem in der gewohnten
 * Schreibweise — die Umgebung soll sich nicht ändern, nur weil die API es tut.
 */
function sender(): { email: string; name?: string } {
  const raw = env.mailFrom.trim()
  const match = /^(.*)<([^>]+)>$/.exec(raw)
  if (!match) return { email: raw }
  const name = match[1].trim().replace(/^"(.*)"$/, '$1')
  return { email: match[2].trim(), ...(name ? { name } : {}) }
}

/**
 * Plunk verschickt ausschliesslich HTML — ein Text mit Zeilenumbrüchen käme
 * als ein einziger Absatz an. Also escapen und die Umbrüche explizit setzen.
 *
 * Die geschweiften Klammern gehören mit escaped: Plunk ersetzt `{{feld}}`
 * durch Kontaktdaten und löscht übrig gebliebene Platzhalter ersatzlos. Eine
 * Besuchernachricht mit `{{…}}` würde sonst still verschwinden.
 */
function toHtml(text: string): string {
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\{/g, '&#123;')
    // Die Mails richten ihre Beschriftungen mit Leerzeichen aus („Was:   …").
    // HTML klappt Folgen von Leerzeichen zusammen, also die inneren festhalten.
    .replace(/ {2,}/g, (run) => '&nbsp;'.repeat(run.length - 1) + ' ')
  return escaped.split('\n').join('<br />')
}

/**
 * E-Mail-Versand über Plunk. Bewusst schlicht: die einzigen Empfänger sind
 * Ersteller, die auf eine Nachricht warten — HTML-Layouts fügen dem nichts
 * hinzu und landen häufiger im Spam. Der Text wird nur so weit in HTML
 * übersetzt, wie die API es verlangt.
 *
 * Wirft nie. Ob ein Fehlschlag den Aufrufer interessiert, entscheidet der
 * Aufrufer: bei der Bestätigungsmail ist er fatal, bei einer Benachrichtigung
 * darf er die schon gespeicherte Antwort des Besuchers nicht verschlucken.
 */
export async function send(mail: Mail): Promise<SendResult> {
  // Ein leerer String ist hier derselbe Fall wie eine fehlende Variable —
  // `.env.example` liefert genau das, und ohne diese Prüfung schickt man
  // Plunk ein `Bearer ` ohne Token und rätselt über den 401.
  if (!process.env.PLUNK_API_KEY?.trim()) {
    if (!warnedMissingKey) {
      warnedMissingKey = true
      console.error(
        '[mail] PLUNK_API_KEY ist nicht gesetzt. Es wird KEINE E-Mail verschickt — ' +
          'Nachrichten landen nur in diesem Log. Siehe .env.example.',
      )
    }
    console.warn(`[mail] nicht verschickt an ${mail.to}: ${mail.subject}\n${mail.text}`)
    return { ok: false, reason: 'not_configured', detail: 'PLUNK_API_KEY fehlt' }
  }

  const from = sender()

  let res: Response
  try {
    res = await fetch(`${PLUNK_API}/v1/send`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.plunkApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: from.email,
        // Plunk kennt den Anzeigenamen als eigenes Feld, nicht als Teil der
        // Adresse; ohne ihn steht die nackte Adresse im Postfach.
        ...(from.name ? { name: from.name } : {}),
        to: mail.to,
        subject: mail.subject,
        body: toHtml(mail.text),
        ...(mail.attachments?.length ? { attachments: mail.attachments } : {}),
      }),
    })
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    console.error('[mail] Plunk nicht erreichbar:', detail)
    return { ok: false, reason: 'unreachable', detail }
  }

  const body = await res.text()

  if (!res.ok) {
    // Der häufigste Fall in der Praxis: die Absenderdomain in MAIL_FROM ist
    // bei Plunk nicht verifiziert. Der Fehlertext sagt das, also mitloggen.
    console.error(
      `[mail] Plunk hat abgelehnt (${res.status}) — from="${env.mailFrom}" to="${mail.to}": ${body}`,
    )
    return { ok: false, reason: 'rejected', detail: `${res.status} ${body}` }
  }

  // Die Message-ID ist der einzige Beleg, dass wirklich etwas rausging —
  // ohne sie lässt sich im Plunk-Log nichts wiederfinden. Plunk verpackt sie
  // in `data.emails[]`, weil derselbe Aufruf mehrere Empfänger kennt.
  let id: string | null = null
  let contactId: string | null = null
  try {
    const parsed = JSON.parse(body) as {
      success?: boolean
      data?: { emails?: { email?: string; contact?: { id?: string } }[] }
    }
    // 2xx mit `success: false` ist laut API nicht vorgesehen, kostet hier aber
    // nur eine Zeile — und ein still verlorener Versand wäre teuer.
    if (parsed.success === false) {
      console.error(
        `[mail] Plunk meldet Misserfolg trotz ${res.status} an ${mail.to}: ${body}`,
      )
      return { ok: false, reason: 'rejected', detail: `${res.status} ${body}` }
    }
    const sent = parsed.data?.emails?.[0]
    id = sent?.email ?? null
    contactId = sent?.contact?.id ?? null
  } catch {
    // Kein JSON trotz 2xx: unerwartet, aber kein Grund, den Versand als
    // gescheitert zu behandeln.
  }
  console.info(`[mail] verschickt an ${mail.to} (${id ?? 'ohne id'}): ${mail.subject}`)

  // Bewusst vor dem Return und mit `await`: die Serverless-Funktion darf nach
  // der Antwort einfrieren, ein nachgelagerter Aufruf käme dann nie an.
  if (mail.forget) {
    if (contactId) {
      if (await deleteContact(contactId)) {
        console.info(`[mail] Kontakt ${contactId} nach dem Versand gelöscht`)
      }
    } else {
      console.error(
        `[mail] Kontakt zu ${mail.to} nicht löschbar — Plunk hat keine Kontakt-ID geliefert: ${body}`,
      )
    }
  }

  return { ok: true, id }
}

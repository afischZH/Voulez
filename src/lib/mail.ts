import 'server-only'

import { env } from '@/lib/env'

type Mail = {
  to: string
  subject: string
  text: string
}

/**
 * E-Mail-Versand über Resend. Bewusst nur Text: die einzigen Empfänger sind
 * Ersteller, die auf eine Nachricht warten — HTML-Layouts fügen dem nichts
 * hinzu und landen häufiger im Spam.
 *
 * Fehler werden geloggt, nicht geworfen: eine nicht zustellbare
 * Benachrichtigung darf niemals die Zusage des Besuchers verschlucken.
 */
export async function send(mail: Mail): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.warn('[mail] RESEND_API_KEY fehlt — E-Mail wird nur geloggt:', mail.subject)
    console.info(mail.text)
    return false
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${env.resendApiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        from: env.mailFrom,
        to: [mail.to],
        subject: mail.subject,
        text: mail.text,
      }),
    })

    if (!res.ok) {
      console.error('[mail] Versand fehlgeschlagen', res.status, await res.text())
      return false
    }
    return true
  } catch (error) {
    console.error('[mail] Versand fehlgeschlagen', error)
    return false
  }
}

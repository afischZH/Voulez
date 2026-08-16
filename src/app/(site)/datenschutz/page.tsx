import type { Metadata } from 'next'
import { Prose } from '@/components/site/prose'

export const metadata: Metadata = { title: 'Datenschutz' }

export default function PrivacyPage() {
  return (
    <Prose title="Datenschutz">
      <p>
        Voulez sammelt so wenig wie möglich. Diese Seite sagt genau, was gespeichert wird,
        warum, und wann es verschwindet. Massgeblich sind das Schweizer Datenschutzgesetz
        (DSG) und die DSGVO.
      </p>

      <h2>Was gespeichert wird, wenn du einen Tresor baust</h2>
      <ul>
        <li>
          <strong>Deine E-Mail-Adresse.</strong> Für die Bestätigung, den Verwaltungslink
          und die Benachrichtigung, wenn jemand antwortet. Sie wird für nichts anderes
          verwendet und nicht weitergegeben.
        </li>
        <li>
          <strong>Der Inhalt des Tresors.</strong> Name des Empfängers, deine Texte, die
          Rätsel samt Lösungen, die Auswahlmöglichkeiten und Zeitfenster.
        </li>
        <li>
          <strong>Die PIN.</strong> Nur als Hashwert (scrypt). Im Klartext existiert sie
          nirgends — auch der Betreiber kann sie nicht auslesen.
        </li>
      </ul>

      <h2>Was gespeichert wird, wenn jemand deinen Tresor öffnet</h2>
      <ul>
        <li>
          <strong>Die Antwort.</strong> Zusage oder Absage, gewählte Unternehmung,
          Zeitpunkt und eine allfällige Nachricht.
        </li>
        <li>
          <strong>Ereignisse.</strong> Dass jemand die Seite geöffnet, ein Rätsel gelöst
          oder den Tresor geöffnet hat — mit Zeitstempel, ohne Namen.
        </li>
        <li>
          <strong>Keine IP-Adressen.</strong> Für die Begrenzung der Versuche wird aus der
          IP ein gekürzter Hashwert gebildet. Die IP selbst wird nicht gespeichert und
          lässt sich aus dem Hash nicht zurückrechnen.
        </li>
      </ul>

      <h2>Cookies</h2>
      <p>
        Ein einziges technisches Cookie, gesetzt beim erfolgreichen Öffnen eines Tresors.
        Es beweist, dass die PIN stimmte, und läuft nach sechs Stunden ab. Kein Tracking,
        keine Werbung, keine Analyse — deshalb auch kein Zustimmungsbanner.
      </p>

      <h2>Wie lange</h2>
      <p>
        Jeder Tresor wird 90 Tage nach seiner Erstellung gelöscht, samt Rätseln, Antwort
        und E-Mail-Adresse. Ein nicht bestätigter Tresor wird nie sichtbar und ebenso
        gelöscht. Früher geht auch: über den Verwaltungslink lässt sich ein Tresor
        jederzeit deaktivieren.
      </p>

      <h2>Wer sonst noch Daten sieht</h2>
      <ul>
        <li>
          <strong>Supabase</strong> (Datenbank, Rechenzentrum Frankfurt, EU) —
          Auftragsverarbeiter für die Speicherung.
        </li>
        <li>
          <strong>Plunk</strong> — Auftragsverarbeiter für den E-Mail-Versand.
        </li>
        <li>
          <strong>Vercel</strong> — Auftragsverarbeiter für den Betrieb der Website.
        </li>
      </ul>
      <p>Es findet keine Weitergabe zu Werbe- oder Analysezwecken statt.</p>

      <h2>Deine Rechte</h2>
      <p>
        Du kannst Auskunft, Berichtigung, Löschung und Herausgabe deiner Daten verlangen.
        Für die Löschung genügt der Verwaltungslink; für alles andere schreib an die
        Adresse im <a href="/impressum">Impressum</a>. Du hast zudem das Recht, dich bei
        einer Aufsichtsbehörde zu beschweren — in der Schweiz beim EDÖB.
      </p>
    </Prose>
  )
}

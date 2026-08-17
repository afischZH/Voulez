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
          <strong>Die E-Mail-Adresse des Empfängers</strong> — nur wenn du sie einträgst.
          Sie wird für eine einzige Nachricht verwendet: die Einladung, die nach deiner
          Bestätigung rausgeht. Darin stehen dein Name, dein erster Satz und der Link zum
          Tresor. Danach wird die Adresse für nichts mehr benutzt, nicht weitergegeben und
          mit dem Tresor gelöscht.
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

      <h2>Wallet-Pässe</h2>
      <p>
        Steht ein Termin, lässt sich das Ticket zusätzlich in Apple Wallet oder Google
        Wallet legen. Die beiden Wege unterscheiden sich, und zwar deutlich:
      </p>
      <ul>
        <li>
          <strong>Apple Wallet</strong> — der Pass entsteht auf unserem Server und wird
          als Datei an dein Gerät übergeben. Apple bekommt dabei nichts zu sehen: weder
          den Termin noch deinen Namen noch die Nachricht, die auf der Rückseite steht.
        </li>
        <li>
          <strong>Google Wallet</strong> — hier geht es nicht ohne Google. Übertragen
          werden dein Vorname, der Anlass, der Termin und der Link zum Ticket.{' '}
          <strong>Nicht übertragen wird die persönliche Nachricht</strong>, und auch keine
          E-Mail-Adresse.
        </li>
      </ul>
      <p>
        Ein gespeicherter Google-Pass liegt danach bei Google und nicht mehr bei uns. Die
        90-Tage-Löschung unten erreicht ihn deshalb nicht — er bleibt, bis du ihn in
        Google Wallet selbst entfernst. Das gilt nur für Leute, die diesen Knopf auch
        wirklich drücken; wer ihn stehen lässt, gibt nichts weiter.
      </p>
      <p>
        Für beide Pässe gilt, was auch für einen Ausdruck oder einen Screenshot gilt: was
        einmal auf einem Gerät liegt, lässt sich von hier aus nicht zurückholen. Ein
        deaktivierter Tresor gibt keine neuen Pässe mehr aus.
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
        <li>
          <strong>Google</strong> — nur für die oben beschriebenen Wallet-Pässe, und nur
          bei denen, die den Knopf „Zu Google Wallet“ drücken.
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

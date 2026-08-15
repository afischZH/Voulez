# Voulez

Eine Einladung, die in einem Tresor liegt. Der Besuch erspielt die Kombination
über kleine Rätsel, findet dahinter den Text, wählt Art und Zeitpunkt der
Unternehmung — und bekommt ein Ticket für den Kalender.

## Der Punkt, an dem alles hängt

**PIN und Rätsellösungen verlassen den Server nie.**

Läge das Kartenbild eines Memory oder die Antwort eines Quiz im
ausgelieferten HTML, wäre der ganze Clou in den DevTools erledigt. Deshalb:

- Jede Rätsel-Prüfung ist ein Server-Call und antwortet nur mit
  „richtig/falsch" plus einer Rückmeldung, die die Lösung nicht verrät.
- `toPlayerConfig()` je Rätseltyp bestimmt, was der Browser sehen darf. Alles
  andere bleibt in der Datenbank.
- Memory deckt Karte für Karte per `peek` auf; das Kartenbild wird
  deterministisch aus dem Server-Secret abgeleitet und nirgends gespeichert.
- Der Einladungstext kommt erst aus der Antwort von `POST /unlock`.
- Es gibt keinen Supabase-Client im Browser. RLS ist deny-all, alle Zugriffe
  laufen über Route Handlers mit dem Service-Role-Key.

Wer daran etwas ändert, muss den Leak-Test aus „Prüfen" unten neu fahren.

## Einrichten

```bash
npm install
cp .env.example .env.local   # Werte eintragen, siehe unten
npm run dev
```

| Variable | Woher |
|---|---|
| `SUPABASE_URL` | Supabase → Project Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | dieselbe Seite, „secret". Umgeht RLS — nie in den Client, nie ins Repo |
| `SESSION_SECRET` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `RESEND_API_KEY` | resend.com → API Keys. Ohne Key werden Mails nur in die Server-Logs geschrieben |
| `MAIL_FROM` | verifizierte Absenderadresse |
| `REPORT_TO` | wohin Missbrauchsmeldungen gehen |
| `SITE_URL` | Basis-URL für Links in E-Mails |

`SESSION_SECRET` darf nach dem ersten Livegang nicht mehr geändert werden —
es leitet die Memory-Kartenbilder ab. Ein neues Secret mischt laufende
Memory-Rätsel neu durch.

## Befehle

```bash
npm run dev          # Entwicklungsserver
npm run build        # Produktionsbuild
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier --write
```

## Aufbau

```
src/app/(site)/          Startseite, Wizard, Rechtstexte — mit Kopf und Fuss
src/app/v/[slug]/        Der Tresor. Bewusst ohne Navigation
src/app/api/             Route Handlers; hier liegt die gesamte Prüflogik
src/lib/puzzles/         Ein Rätseltyp = eine Datei + ein Eintrag in index.ts
src/lib/crypto.ts        scrypt für die PIN, SHA-256 für Tokens
src/lib/vault.ts         Trennung zwischen "vor dem Öffnen" und "danach"
```

### Einen Rätseltyp ergänzen

1. `src/lib/puzzles/<name>.ts` nach dem Muster von `numberlock.ts`. Entscheidend
   ist `toPlayerConfig` — was dort fehlt, sieht der Browser nie.
2. Eintrag in `src/lib/puzzles/index.ts` und `catalog.ts`.
3. Player-Komponente unter `src/components/vault/puzzles/`, Editor unter
   `src/components/create/puzzle-editors.tsx`.
4. `PUZZLE_KINDS` in `contract.ts` erweitern und die Datenbank-Constraint
   `vault_puzzles.type` per Migration nachziehen.

Die Route Handlers bleiben unverändert.

## Prüfen

**Der Leak-Test** — nach jeder Änderung an Rätseln oder am Ausliefern:

```bash
curl -s http://localhost:3000/v/test | grep -E '4729|"answer"|"secret"|"word"|"symbols"'
```

Kein Treffer. Bei Auswahl-Quiz stehen die Möglichkeiten im HTML — das ist
richtig so, solange nicht markiert ist, welche stimmt.

**Brute-Force** — zwölf falsche PINs hintereinander: ab dem zehnten Versuch
423 (Tresor verriegelt), danach 429 (IP-Limit). Auch die richtige PIN wird in
dieser Zeit abgewiesen.

**Der Durchlauf** — `/v/test` (PIN 4729, vier Quizfragen) oder `/v/demo4`
(dieselbe PIN, alle vier Rätseltypen). Ticket in Apple und Google Kalender
importieren, Druckvorschau ansehen.

**Vor dem Livegang**

- Impressum ausfüllen — die Platzhalter sind im Text markiert
- Tastatur-Durchlauf und VoiceOver über Tür, PIN-Pad und Rätsel
- `prefers-reduced-motion: reduce` — der Flow muss vollständig spielbar bleiben
- Demo-Tresore `test` und `demo4` aus der Datenbank entfernen

## Betrieb

Ein pg_cron-Job (`purge-expired-vaults`, täglich 03:17 UTC) löscht abgelaufene
Tresore und nie bestätigte Entwürfe älter als sieben Tage. Ohne ihn wäre das
Löschversprechen in der Datenschutzerklärung unwahr.

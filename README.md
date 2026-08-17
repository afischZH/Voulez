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
| `PLUNK_API_KEY` | useplunk.com → Project settings → API keys, der geheime `sk_`-Key. Ohne Key werden Mails nur in die Server-Logs geschrieben |
| `MAIL_FROM` | verifizierte Absenderadresse |
| `REPORT_TO` | wohin Missbrauchsmeldungen gehen |
| `SITE_URL` | Basis-URL für Links in E-Mails |
| `CRON_SECRET` | schützt den täglichen Aufräum-Lauf, gleiche Erzeugung wie `SESSION_SECRET` |

Optional dazu die Wallet-Pässe: fünf `APPLE_PASS_*`/`APPLE_TEAM_ID`-Werte und
drei `GOOGLE_WALLET_*`-Werte. Beide Blöcke werden getrennt und vollständig
geprüft — fehlt in einem auch nur ein Wert, erscheint der zugehörige Knopf unter
dem Ticket gar nicht erst. Die Beschaffung steht in `.env.example`, die Technik
dahinter in `PROJEKTUEBERSICHT.md` §7.

### E-Mail-Versand: Plunk mit voulez.love

Die Domain liegt bei Infomaniak (`ns11/ns12.infomaniak.ch`), verschickt wird
über Plunk. Zu verifizieren ist die Wurzel `voulez.love`.

1. Plunk → **Project settings → Domains → Add domain** → `voulez.love`.
2. Die angezeigten Einträge in die Infomaniak-DNS-Zone übertragen (Manager →
   Domains → voulez.love → **DNS-Zone**). Ins Feld „Quelle" gehört **nur der
   Teil vor der Domain**, Infomaniak hängt `voulez.love` selbst an:

   | Typ | Zweck |
   |---|---|
   | CNAME ×3 | DKIM-Signatur |
   | TXT | SPF |
   | MX | Bounce- und Beschwerde-Rückläufer |
   | TXT auf `_dmarc` | `v=DMARC1; p=none;` (optional, aber empfohlen) |

   Namen und Werte sind kontospezifisch — immer aus dem Dashboard kopieren.
   **SPF gibt es nur einmal pro Domain**: existiert schon ein Eintrag, das
   `include:` von Plunk in den bestehenden hineinschreiben, statt einen
   zweiten anzulegen. Zwei SPF-Einträge lassen beide fehlschlagen.
3. In Plunk die Verifizierung anstossen. Meist ist sie in wenigen Minuten
   durch, bei zähem DNS-Cache dauert es länger.
4. `PLUNK_API_KEY` (der geheime `sk_`-Key — der öffentliche `pk_`-Key darf
   `/v1/send` nicht) und `MAIL_FROM` in `.env.local` und beim Hoster
   eintragen.

Prüfen, ob die Einträge draussen angekommen sind (Namen aus dem Dashboard
einsetzen):

```bash
dig +short TXT voulez.love; dig +short MX voulez.love
```

Ohne `PLUNK_API_KEY` läuft alles weiter, nur landen die Mails im Server-Log
statt im Postfach — sichtbar an der Zeile `[mail] nicht verschickt an …`.
Ein Tresor wird in dem Fall bewusst **nicht** angelegt: die Bestätigungsmail
trägt die einzigen beiden Tokens, die es je gibt.

### Aufräumen nach 90 Tagen

Die Datenschutzerklärung sagt zu, dass ein Tresor 90 Tage nach der Erstellung
verschwindet — samt Rätseln, Antwort und E-Mail-Adresse. Eingelöst wird das
vom täglichen Lauf `/api/cron/cleanup`, in drei Schritten:

| Was | Frist | Wie |
|---|---|---|
| Tresore | `expires_at`, also 90 Tage ab Erstellung | ein `DELETE`; Rätsel, Termine, Antwort und Ereignisse hängen mit `ON DELETE CASCADE` daran |
| Rate-Limit-Zeilen | 7 Tage | enthalten IP-Hashes; das längste Zählfenster ist ein Tag |
| Plunk-Kontakte | 90 Tage | höchstens 200 pro Lauf |

Die Adresse des Besuchers wartet nicht auf diesen Lauf — ihr Kontakt wird
direkt nach dem Ticket gelöscht.

Der Zeitplan steht in `vercel.json`; Vercel richtet den Cron beim nächsten
Deploy ein und schickt `CRON_SECRET` als Bearer-Token mit. Die Variable muss
also auch beim Hoster gesetzt sein — fehlt sie, antwortet der Endpunkt mit
503 und räumt nichts weg. Von Hand anstossen:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://voulez.love/api/cron/cleanup
```

Die Antwort zählt, was passiert ist:

```json
{"vaults":2,"rateLimits":140,"contacts":{"deleted":3,"failed":0,"more":false}}
```

Ein Schritt, der scheitert, hält die anderen nicht auf; er steht dann als
`null` da und mit seinem Grund unter `failures`. `more: true` heisst, dass
der Deckel von 200 Kontakten erreicht war — der nächste Tag macht weiter.
Das Plunk-Projekt sollte Voulez allein gehören: der Lauf löscht jeden
Kontakt, der älter als 90 Tage ist, ohne zu fragen, wer ihn angelegt hat.

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

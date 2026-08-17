# Voulez — Projektübersicht

Stand: 16. August 2026 · Branch `main` · letzter Commit `c0d8de4`

---

## 1. Was das Produkt ist

Eine Einladung liegt in einem digitalen Tresor. Der Besuch bekommt einen Link
(`/v/<slug>`), erspielt über 2–6 kleine Rätsel die PIN-Kombination, findet
dahinter den Einladungstext, wählt Art und Zeitpunkt der Unternehmung — und
bekommt ein Ticket als `.ics` für den Kalender.

Sprache der Oberfläche und des Codes: **Deutsch** (de-CH-Formatierung,
Standard-Zeitzone `Europe/Zurich`).

**Der Punkt, an dem alles hängt:** PIN und Rätsellösungen verlassen den Server
nie. Jede Prüfung ist ein Server-Call. Es gibt keinen Supabase-Client im
Browser.

---

## 2. Techstack

| Ebene         | Wahl                                                        | Version    |
| ------------- | ----------------------------------------------------------- | ---------- |
| Framework     | Next.js (App Router, React Server Components)               | `16.3.1`   |
| UI-Runtime    | React / React DOM                                           | `19.2.8`   |
| Sprache       | TypeScript, `strict: true`                                  | `^5`       |
| Styling       | Tailwind CSS v4 (CSS-first, `@theme` in `globals.css`)      | `^4`       |
| Motion        | `motion` (Framer-Motion-Nachfolger)                         | `^13.1.0`  |
| Validierung   | Zod — dieselben Schemata auf Client und Server              | `^4.4.3`   |
| Datenbank-SDK | `@supabase/supabase-js`                                     | `^2.112.3` |
| IDs           | `nanoid` (`customAlphabet` für Slugs)                       | `^6.0.1`   |
| Server-Grenze | `server-only`                                               | `^0.0.1`   |
| Krypto        | Node `node:crypto` (scrypt, HMAC, SHA-256) — keine Library  | —          |
| Kalender      | eigener RFC-5545-Writer in `src/lib/ics.ts` — keine Library | —          |
| Zeitzonen     | `Intl.DateTimeFormat` in `src/lib/time.ts` — keine Library  | —          |

Dev-Tooling: ESLint 9 (`eslint-config-next` flat config), Prettier 3 mit
`prettier-plugin-tailwindcss`, `@tailwindcss/postcss`.

> **Wichtig für Agenten:** `AGENTS.md` weist darauf hin, dass diese Next.js-
> Version von Trainingsdaten abweicht. Vor Code-Änderungen die Guides unter
> `node_modules/next/dist/docs/` lesen.

---

## 3. Backend-Services

### 3.1 Supabase — Datenbank (einzige Datenablage)

|            |                                                                                 |
| ---------- | ------------------------------------------------------------------------------- |
| Projekt-ID | `kivmcjlrepexusiagtac`                                                          |
| Region     | `eu-central-1`                                                                  |
| Postgrest  | 14.15                                                                           |
| Zugriff    | **ausschliesslich** über Service-Role-Key in Route Handlers / Server Components |
| RLS        | **deny-all** — es gibt bewusst keinen Browser-Client                            |

Der einzige Zugang ist `db()` in `src/lib/supabase/server.ts` (Singleton,
`persistSession: false`, Header `x-application-name: voulez`). Das Modul
importiert `server-only`: ein versehentlicher Client-Import bricht den Build.

Typen: `src/lib/supabase/types.ts`, generiert —
`npx supabase gen types typescript --project-id kivmcjlrepexusiagtac`

Migrationen: `supabase/migrations/`, dieselben Versionsnummern wie die
Historie im Projekt (`supabase_migrations.schema_migrations`) — bereits
angewandte Stände werden dadurch nicht erneut ausgeführt. Eine neue Migration
gehört als Datei hierher **und** in die Datenbank; wer sie nur remote anwendet,
hinterlässt ein Repo, aus dem sich das Schema nicht mehr aufbauen lässt.

### 3.2 Plunk — E-Mail-Versand

|              |                                                                                                                     |
| ------------ | ------------------------------------------------------------------------------------------------------------------- |
| API-Host     | `https://next-api.useplunk.com` (**nicht** `api.useplunk.com` — dort fehlen die Kontakt-Routen)                     |
| Key          | geheimer `sk_`-Key; der öffentliche `pk_` darf `/v1/send` nicht                                                     |
| Absender     | `Voulez <post@voulez.love>`                                                                                         |
| Besonderheit | Plunk verschickt nur HTML → `toHtml()` escapet Text inkl. `{`, weil `{{feld}}` als Platzhalter ersetzt würde        |
| Besonderheit | Plunk legt zu jeder Empfängeradresse einen Kontakt an → `send({ forget: true })` löscht ihn direkt nach dem Versand |

Ohne `PLUNK_API_KEY` läuft die App weiter, Mails landen nur im Server-Log
(`[mail] nicht verschickt an …`). Ein Tresor wird dann **bewusst nicht**
angelegt — die Bestätigungsmail trägt die einzigen beiden Tokens, die es je
gibt, und wird bei Fehlschlag samt Tresor zurückgerollt.

Das Plunk-Projekt sollte Voulez allein gehören: der Aufräum-Lauf löscht jeden
Kontakt älter als 90 Tage, ohne zu fragen, wer ihn angelegt hat.

### 3.3 Vercel — Hosting und Cron

|               |                                                               |
| ------------- | ------------------------------------------------------------- |
| Projekt       | `voulez` (`prj_yB4VAwPOYgOTDsz4SeegKJSxKGCx`)                 |
| Team          | `team_D3Hb5LjZeDnfD9cCNT8zmjpV`                               |
| Cron          | `GET /api/cron/cleanup`, täglich `20 4 * * *` (`vercel.json`) |
| Auth des Cron | `CRON_SECRET` als Bearer-Token, `timingSafeEqual`-Vergleich   |

### 3.4 Infomaniak — DNS für `voulez.love`

Nameserver `ns11/ns12.infomaniak.ch`. Details in `DNS.md` und
`DNS-mail-records.md`. Der entscheidende Punkt:

- Plunk sendet über die MAIL-FROM-Domain **`plunk.voulez.love`** — dort liegen
  der Rückläufer-MX und der SPF-Eintrag, der zählt.
- DKIM liegt auf der **Wurzel** (`d=voulez.love`), damit die Signatur zum
  `From:` passt. **DMARC besteht hier über DKIM, nicht über SPF.**
- Der Wurzel-SPF `v=spf1 -all` ist eine Altlast; empfohlen ist
  `v=spf1 include:amazonses.com ~all`. **Eine Domain darf genau einen
  SPF-Eintrag haben** — zwei ergeben `PermError`, beide wertlos.

---

## 4. Datenmodell

Sechs Tabellen. Alles hängt mit `ON DELETE CASCADE` am Tresor.

### `vaults`

Der Tresor selbst.

| Spalte                                            | Zweck                                                                                                       |
| ------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `slug`                                            | 8 Zeichen aus `23456789abcdefghjkmnpqrstuvwxyz` — ohne Vokale und Verwechsler, weil der Link abgetippt wird |
| `pin_hash`, `pin_length`                          | scrypt-Hash der PIN; Länge = Anzahl Rätsel                                                                  |
| `edit_token_hash`                                 | SHA-256; einziger Nachweis für `/verwalten`                                                                 |
| `confirm_token_hash`                              | SHA-256; wird beim Bestätigen auf `null` gesetzt                                                            |
| `status`                                          | `draft` → `live` → `disabled`                                                                               |
| `failed_attempts`, `locked_until`                 | Selbstverriegelung nach Fehlversuchen                                                                       |
| `expires_at`                                      | `created_at + 90 Tage`, wird nirgends überschrieben                                                         |
| `creator_email`, `creator_name`, `recipient_name` | Beteiligte                                                                                                  |
| `intro_text`, `reveal_text`, `closing_text`       | Text vor / hinter / nach dem Öffnen                                                                         |
| `timezone`, `theme`                               | Darstellung                                                                                                 |
| `allow_custom_proposal`                           | Ob der Besuch eine eigene Unternehmung und einen eigenen Termin eintragen darf, statt nur zu wählen         |

### Angehängte Tabellen

| Tabelle         | Inhalt                                                                                                                                                                                                                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vault_puzzles` | `type`, `position`, `config` (JSON, **enthält die Lösung**), `reveal_digit`, `title`, `hint_text`                                                                                                                                                                                                             |
| `date_options`  | Was man tun könnte — `label`, `icon`, `description`, `position`                                                                                                                                                                                                                                               |
| `date_slots`    | Zeitfenster — `day`, `time_from`, `time_to`                                                                                                                                                                                                                                                                   |
| `responses`     | Genau eine pro Tresor (`isOneToOne`): `accepted`, `option_id`, `custom_label`, `custom_time`, `starts_at`, `duration_min`, `message`. Bei einer Zusage gilt `starts_at is not null and (option_id is not null or custom_label is not null)` — entweder eine angebotene Möglichkeit oder ein eigener Vorschlag |
| `vault_events`  | Fire-and-forget-Log: `unlocked`, `unlock_failed`, `puzzle_solved`, `ticket_mailed`, …                                                                                                                                                                                                                         |
| `rate_limits`   | `bucket`, `hits`, `window_start` — enthält IP-**Hashes**, nie rohe IPs                                                                                                                                                                                                                                        |

### Postgres-Funktionen (RPC)

| Funktion                                                  | Zweck                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------- |
| `hit_rate_limit(p_bucket, p_limit, p_window)` → `boolean` | atomarer Zähler; in Serverless die einzige wirksame Bremse |
| `register_failed_unlock(p_vault_id)` → `timestamp`        | zählt hoch und gibt `locked_until` zurück                  |

### pg_cron

`purge-expired-vaults`, täglich 03:17 UTC — löscht abgelaufene Tresore und nie
bestätigte Entwürfe älter als sieben Tage. Zweite Sicherung neben dem
Vercel-Cron.

---

## 5. API — Route Handlers

Alle Antworten mit `Cache-Control: no-store, no-cache, must-revalidate`
(`src/lib/http.ts`). Fehlerform: `{ error, message, … }`.

| Route                              | Methode | Schutz                              | Zweck                                                                                                                                                                                                       |
| ---------------------------------- | ------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/api/vaults`                      | POST    | Rate-Limit `create`                 | Tresor als `draft` anlegen, Bestätigungsmail schicken; bei Mail-Fehler Rollback                                                                                                                             |
| `/api/vaults/disable`              | POST    | Edit-Token + 20/h                   | Tresor auf `disabled` setzen                                                                                                                                                                                |
| `/api/v/[slug]/puzzles/[puzzleId]` | POST    | Rate-Limit `puzzle`                 | `{attempt}` prüfen → `correct` + `digit`, oder `feedback`; `{peek: n}` deckt eine Memory-Karte auf                                                                                                          |
| `…/puzzles/[puzzleId]/surrender`   | POST    | ≥ 3 Fehlversuche                    | Notausgang: gibt die Ziffer heraus                                                                                                                                                                          |
| `/api/v/[slug]/unlock`             | POST    | Rate-Limit `unlock` + Tresor-Sperre | PIN prüfen; erst hier kommt `revealText` heraus, setzt Öffnungs-Cookie                                                                                                                                      |
| `/api/v/[slug]/respond`            | POST    | Öffnungs-Cookie + Rate-Limit        | Zu-/Absage speichern, Ersteller benachrichtigen (Mail mit `await`, nicht nebenher — sonst friert die Funktion vorher ein). Eigener Vorschlag (`customLabel`, freier Termin) nur bei `allow_custom_proposal` |
| `/api/t/[token]/ticket.ics`        | GET     | Ticket-Token                        | Kalenderdatei zum gespeicherten Ticket                                                                                                                                                                      |
| `/api/v/[slug]/ticket/email`       | POST    | Öffnungs-Cookie + 4/h               | Ticket an eine frei getippte Adresse; Kontakt wird sofort gelöscht _(neu, noch nicht committet)_                                                                                                            |
| `/api/report`                      | POST    | 5/h                                 | Missbrauchsmeldung an `REPORT_TO`; sperrt bewusst nichts automatisch                                                                                                                                        |
| `/api/cron/cleanup`                | GET     | `CRON_SECRET`                       | Aufräum-Lauf, siehe unten                                                                                                                                                                                   |

### Seiten

| Pfad                                    | Inhalt                                          |
| --------------------------------------- | ----------------------------------------------- |
| `/`                                     | Startseite                                      |
| `/erstellen`                            | Wizard                                          |
| `/bestaetigen?token=`                   | Doppel-Opt-In, `noindex`                        |
| `/verwalten?token=`                     | Tresor deaktivieren                             |
| `/v/[slug]`                             | Der Tresor — bewusst ohne Navigation und Footer |
| `/t/[token]`                            | Das gespeicherte Ticket, `noindex`              |
| `/impressum`, `/datenschutz`, `/melden` | Rechtstexte                                     |

---

## 6. Rätselsystem

Vier Typen, registriert in `src/lib/puzzles/index.ts`: `quiz`, `numberlock`,
`wordle`, `memory`.

Ein Typ implementiert `PuzzleDefinition` (`contract.ts`):

| Teil                 | Rolle                                                                                     |
| -------------------- | ----------------------------------------------------------------------------------------- |
| `configSchema`       | validiert die gespeicherte Konfiguration **inklusive Lösung**                             |
| `attemptSchema`      | validiert den Versuch des Besuchers                                                       |
| **`toPlayerConfig`** | **die einzige Sicht, die der Browser je sieht** — was hier fehlt, verlässt den Server nie |
| `verify`             | Prüfung, serverseitig                                                                     |
| `feedback?`          | Rückmeldung ohne Lösungsverrat (Wordle-Farben, Mastermind-Hinweise)                       |
| `peek?`              | Einzelzustand nachfragen — Memory deckt so Karte für Karte auf                            |

`catalog.ts` ist bewusst von der Registry getrennt: der Katalog läuft im
Browser-Wizard, die Registry zieht über `memory.ts` `server-only` mit sich.

Die PIN ist immer die Folge der Rätsel-Ziffern in ihrer Reihenfolge
(`pinFor()` in `draft.ts`).

**Neuen Typ ergänzen:** Datei unter `src/lib/puzzles/`, Eintrag in `index.ts`
und `catalog.ts`, Player unter `src/components/vault/puzzles/`, Editor in
`puzzle-editors.tsx`, `PUZZLE_KINDS` in `contract.ts` erweitern, DB-Constraint
`vault_puzzles.type` per Migration nachziehen. **Die Route Handlers bleiben
unverändert.**

---

## 7. Sicherheitskonzept

### Kein Leak an den Browser

- Kein Supabase-Client im Browser, kein `NEXT_PUBLIC_`-Prefix — sonst wären
  `pin_hash` und `vault_puzzles.config` über PostgREST erreichbar.
- `toPlayerConfig()` schneidet die Lösung ab.
- `revealText` kommt erst aus der Antwort von `POST /unlock`.
- Memory-Kartenbilder werden deterministisch aus dem Server-Secret abgeleitet
  und nirgends gespeichert.

### Krypto (`src/lib/crypto.ts`)

| Zweck           | Verfahren                                                                     |
| --------------- | ----------------------------------------------------------------------------- |
| PIN             | scrypt, `N=2^15, r=8, p=1`, Format `scrypt$N$r$p$salt$hash` (base64url)       |
| Tokens          | 32 Byte Zufall, gespeichert als SHA-256 (hochentropisch → kein KDF nötig)     |
| Vergleiche      | durchweg `timingSafeEqual`                                                    |
| Rätselantworten | normalisiert (NFD, Akzente/Satzzeichen weg) und in konstanter Zeit verglichen |

Der Hash ist ausdrücklich **nicht** der Hauptschutz — eine PIN hat nur 10⁴–10⁶
Möglichkeiten. Der echte Schutz ist das Rate-Limit.

### Öffnungs-Nachweis (`src/lib/session.ts`)

HttpOnly-Cookie `voulez_open_<slug>` mit HMAC-SHA-256 über `vaultId.expires`,
TTL 6 Stunden, `sameSite: lax`, `secure` in Produktion. Ohne ihn liesse sich
`/respond` und `/ticket/email` direkt aufrufen und die PIN überspringen.

> `SESSION_SECRET` darf nach dem Livegang **nicht** mehr geändert werden — es
> leitet die Memory-Kartenbilder ab.

### Ticket-Link (`src/lib/ticket.ts`)

`/t/<token>` ist ein Capability-Link: 32 Byte Zufall, gespeichert als
`responses.ticket_token_hash`. Wer ihn hat, sieht die Karte — ohne PIN, ohne
Öffnungs-Cookie. Das ist Absicht: der Besuch soll seine Verabredung morgen noch
aufrufen können, und der Ersteller kommt an den beantworteten Tresor nicht mehr
heran. Der Token entsteht einmal in `/respond` und steht danach nur noch dort,
wo ihn jemand mitgenommen hat. Ein gesperrter oder abgelaufener Tresor zeigt
auch sein Ticket nicht mehr.

### Rate-Limits (`src/lib/rate-limit.ts`)

DB-gestützt, weil Serverless-Instanzen keinen Speicher teilen. Im Fehlerfall
**dichtmachen** (`return false`).

| Bucket       | Limit | Fenster |
| ------------ | ----- | ------- |
| `unlock`     | 12    | 5 min   |
| `puzzle`     | 60    | 5 min   |
| `create`     | 5     | 1 h     |
| `respond`    | 10    | 1 h     |
| `ticketMail` | 4     | 1 h     |

Dazu die Selbstverriegelung des Tresors über `register_failed_unlock` (ab dem
zehnten Fehlversuch HTTP 423 — auch die richtige PIN wird dann abgewiesen).

IPs werden nur als SHA-256-Fingerprint (22 Zeichen) gespeichert.

### HTTP-Header (`next.config.ts`, auf `/:path*`)

`X-Frame-Options: DENY` · `X-Content-Type-Options: nosniff` ·
`Referrer-Policy: no-referrer` (der Slug steht im Pfad) ·
`Permissions-Policy: camera=(), microphone=(), geolocation=(), interest-cohort=()` ·
`Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` ·
`poweredByHeader: false`.

### Missbrauchsschutz

Doppel-Opt-In: bis zum Klick in der Mail ist der Tresor `draft` und der Slug
geheim. Ohne das liesse sich die Seite als Versandwerkzeug für fremde Adressen
benutzen.

---

## 8. Konfiguration

### Umgebungsvariablen (`.env.example` → `.env.local`)

| Variable                    | Pflicht      | Woher / Erzeugung                                                                |
| --------------------------- | ------------ | -------------------------------------------------------------------------------- |
| `SUPABASE_URL`              | ja           | Supabase → Project Settings → API                                                |
| `SUPABASE_SERVICE_ROLE_KEY` | ja           | dieselbe Seite, „secret". Umgeht RLS — nie in den Client, nie ins Repo           |
| `SESSION_SECRET`            | ja           | `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |
| `PLUNK_API_KEY`             | ja           | Plunk → Project settings → API keys, der geheime `sk_`-Key                       |
| `REPORT_TO`                 | ja           | Zieladresse für Missbrauchsmeldungen                                             |
| `MAIL_FROM`                 | nein         | Default `Voulez <post@voulez.love>`                                              |
| `SITE_URL`                  | nein         | Default `http://localhost:3000`; in Produktion `https://voulez.love`             |
| `CRON_SECRET`               | für den Cron | wie `SESSION_SECRET`; ohne Wert antwortet `/api/cron/cleanup` mit 503            |

`src/lib/env.ts` liest sie über Getter und wirft bei fehlendem Pflichtwert.
Alle Variablen sind serverseitig — bewusst kein `NEXT_PUBLIC_`.

> Umgebungsvariablen bei Vercel wirken erst im **nächsten** Deployment, nicht
> rückwirkend.

### Dateien

| Datei                 | Inhalt                                                             |
| --------------------- | ------------------------------------------------------------------ |
| `next.config.ts`      | Security-Header, `poweredByHeader: false`                          |
| `vercel.json`         | Cron-Zeitplan `20 4 * * *`                                         |
| `tsconfig.json`       | `strict`, `moduleResolution: bundler`, Alias `@/*` → `./src/*`     |
| `eslint.config.mjs`   | Flat Config: `core-web-vitals` + `typescript`                      |
| `postcss.config.mjs`  | nur `@tailwindcss/postcss`                                         |
| `.prettierrc.json`    | keine Semikolons, Single Quotes, `printWidth: 90`, Tailwind-Plugin |
| `.claude/launch.json` | Dev-Server `npm run dev` auf Port 3000                             |
| `.gitignore`          | `.env*` ignoriert, `.env.example` ausgenommen                      |

---

## 9. Datenschutz und Aufräumen

Die Datenschutzerklärung sagt zu: 90 Tage nach Erstellung ist ein Tresor weg,
samt Rätseln, Antwort und E-Mail-Adresse. Eingelöst von
`GET /api/cron/cleanup` in drei unabhängigen Schritten:

| Was               | Frist                                | Wie                                                   |
| ----------------- | ------------------------------------ | ----------------------------------------------------- |
| Tresore           | `expires_at` (90 Tage ab Erstellung) | ein `DELETE`, alles Weitere per `ON DELETE CASCADE`   |
| Rate-Limit-Zeilen | 7 Tage                               | enthalten IP-Hashes; längstes Zählfenster ist ein Tag |
| Plunk-Kontakte    | 90 Tage                              | max. 200 pro Lauf (`maxDuration = 60`)                |

Ein scheiternder Schritt hält die anderen nicht auf — er steht als `null` da,
sein Grund unter `failures`. Nur wenn alle drei scheitern, gibt es 502 (ein
500 würde Vercel bloss zur Wiederholung mit denselben Daten bewegen).

Die Adresse des Besuchers wartet nicht auf diesen Lauf: ihr Plunk-Kontakt wird
direkt nach dem Ticket-Versand gelöscht.

Von Hand anstossen:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" https://voulez.love/api/cron/cleanup
```

Antwort:

```json
{
  "vaults": 2,
  "rateLimits": 140,
  "contacts": { "deleted": 3, "failed": 0, "more": false }
}
```

---

## 10. Design-System

Thema: **Art Deco Heist** — ein dunkler Raum, ein Tresor aus gebürstetem
Stahl, Messing als einziger Akzent. Bewusst **nur dunkel** (`color-scheme:
dark`), kein Light-Mode: der Raum ist das Design.

Tokens in `src/app/globals.css` unter `@theme` (Tailwind v4, CSS-first):

| Gruppe       | Werte                                                                         |
| ------------ | ----------------------------------------------------------------------------- |
| Raum         | `--color-ink #0a0d13`, `ink-raised`, `ink-sunk`                               |
| Tresorkorpus | `--color-steel-900` … `steel-500`                                             |
| Akzent       | `--color-brass #c8a44d`, `brass-bright`, `brass-dim` (4.91:1), `brass-shadow` |
| Schrift      | `--color-parchment #f3ece0`, `fog`, `fog-dim` (4.75:1)                        |
| Zustände     | `--color-signal-ok`, `--color-signal-no`                                      |
| Skala        | modular 1.25, `--text-2xs` … `--text-4xl`                                     |
| Easing       | `--ease-vault`, `--ease-clunk`                                                |

Schriften über `next/font/google`: **Cinzel** (Display), **Instrument Sans**
(Text), **Geist Mono** (Zahlen). Zahlen laufen durchweg tabellarisch, damit
Dial, PIN und Ticket nicht springen.

Zugänglichkeit ist Vorgabe, nicht Kür: der ganze Flow muss per Tastatur
spielbar sein, `:focus-visible` ist explizit gestylt,
`prefers-reduced-motion: reduce` muss den Flow vollständig erhalten
(`MotionProvider`).

---

## 11. Verzeichnisstruktur

```
src/app/(site)/          Startseite, Wizard, Rechtstexte — mit Kopf und Fuss
src/app/v/[slug]/        Der Tresor. Bewusst ohne Navigation
src/app/api/             Route Handlers; hier liegt die gesamte Prüflogik
src/components/create/   Wizard: Felder, Rätsel-Editoren, Slot-Picker
src/components/vault/    Tür, PIN-Pad, Rätsel-Hub, Player
src/components/invitation/  Flow nach dem Öffnen, Ticket, Ticket-Mailer
src/lib/puzzles/         Ein Rätseltyp = eine Datei + ein Eintrag in index.ts
src/lib/crypto.ts        scrypt für die PIN, SHA-256 für Tokens
src/lib/vault.ts         Trennung zwischen "vor dem Öffnen" und "danach"
src/lib/supabase/        Der einzige DB-Zugang, plus generierte Typen
```

---

## 12. Befehle

```bash
npm run dev          # Entwicklungsserver, Port 3000
npm run build        # Produktionsbuild
npm run typecheck    # tsc --noEmit
npm run lint         # eslint
npm run format       # prettier --write .
```

Es gibt **keine Testsuite**. Geprüft wird von Hand:

**Leak-Test** — nach jeder Änderung an Rätseln oder am Ausliefern:

```bash
curl -s http://localhost:3000/v/test | grep -E '4729|"answer"|"secret"|"word"|"symbols"'
```

Kein Treffer erwartet. Bei Auswahl-Quiz stehen die Möglichkeiten im HTML — das
ist richtig, solange nicht markiert ist, welche stimmt.

**Brute-Force** — zwölf falsche PINs: ab dem zehnten 423, danach 429.

**Durchlauf** — `/v/test` (PIN 4729, vier Quizfragen) oder `/v/demo4`
(dieselbe PIN, alle vier Rätseltypen). Ticket in Apple und Google Kalender
importieren, Druckvorschau ansehen.

---

## 13. Offene Punkte

**Vor dem Livegang** (aus `README.md`):

1. Impressum ausfüllen — die Platzhalter sind im Text markiert
2. Tastatur-Durchlauf und VoiceOver über Tür, PIN-Pad und Rätsel
3. `prefers-reduced-motion: reduce` durchspielen
4. Demo-Tresore `test` und `demo4` aus der Datenbank entfernen
5. Wurzel-SPF von `v=spf1 -all` auf `v=spf1 include:amazonses.com ~all` ändern

**Nicht committet** (Stand `git status`): der Ticket-per-Mail-Weg —
`src/app/api/v/[slug]/ticket/email/route.ts` und
`src/components/invitation/ticket-mailer.tsx` — sowie `DNS.md` und
`DNS-mail-records.md`. Dazu Änderungen an acht bestehenden Dateien
(`bestaetigen/page.tsx`, `respond/route.ts`, `vaults/route.ts`,
`create-wizard.tsx`, `invitation-flow.tsx`, `ticket.tsx`, `draft.ts`,
`rate-limit.ts`, `time.ts`).

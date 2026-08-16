# DNS für voulez.love

Zwei Dinge fehlen: die Domain zeigt auf nichts, und Mails von ihr werden
abgelehnt. Beides wird in derselben Zone erledigt.

**Wo:** Infomaniak Manager → Domains → voulez.love → **DNS-Zone**.
Ins Feld „Quelle" gehört **nur der Teil vor der Domain** — leer lassen heisst
Wurzel (`voulez.love`), `www` heisst `www.voulez.love`.

## Was heute in der Zone steht

```
A / AAAA   — nichts
MX         10 inbound-smtp.eu-north-1.amazonaws.com
TXT        "v=spf1 -all"
```

Dazu `_dmarc` auf `p=reject`. Der SPF-Eintrag ist der wichtigste Fund:
`-all` ohne `include:` heisst „niemand darf im Namen dieser Domain senden".
Solange er so dasteht, hilft auch ein perfektes DKIM nichts.

Diese drei Einträge stehen dem Versand im Weg und werden in
[DNS-mail-records.md](DNS-mail-records.md) einzeln durchgegangen — samt der
Reihenfolge, in der man sie anfasst.

## Teil 1 — Die Website erreichbar machen

1. Vercel → Projekt `voulez` → Settings → **Domains** → `voulez.love`
   hinzufügen (und `www.voulez.love`, wenn gewünscht).
2. Vercel zeigt danach die einzutragenden Werte an: ein `A` für die Wurzel,
   ein `CNAME` für `www`. **Diese Werte aus dem Dashboard kopieren**, nicht
   aus Anleitungen im Netz — Vercel hat die IP-Adressen geändert, alte
   Werte zeigen ins Leere.
3. Beides in der Infomaniak-Zone anlegen (A mit leerer Quelle, CNAME mit
   Quelle `www`).
4. Warten, bis es draussen ankommt:

   ```bash
   dig +short voulez.love; dig +short www.voulez.love
   ```

5. In Vercel `SITE_URL=https://voulez.love` setzen — **und neu deployen**.
   Umgebungsvariablen wirken erst im nächsten Deployment, nicht rückwirkend.
   Ohne das zeigen die Links in den Mails weiter auf die alte Adresse.

## Teil 2 — Den Versand freischalten

1. Plunk → Project settings → **Domains** → `voulez.love` hinzufügen.
2. Plunk zeigt fünf Einträge: **3 × CNAME** (DKIM), **1 × TXT** (SPF),
   **1 × MX** (Rückläufer bei Bounces und Beschwerden).
3. **SPF ersetzen, nicht danebenlegen.** Eine Domain darf genau einen
   SPF-Eintrag haben; zwei machen beide ungültig. Aus dem bestehenden

   ```
   v=spf1 -all
   ```

   wird der Include von Plunk plus ein weiches Ende:

   ```
   v=spf1 include:<Wert aus dem Plunk-Dashboard> ~all
   ```

4. **Beim MX aufpassen:** auf der Wurzel liegt schon
   `inbound-smtp.eu-north-1.amazonaws.com`. Verlangt Plunk seinen MX auf
   demselben Namen, konkurrieren die beiden — dann erst klären, wofür der
   bestehende Eintrag da ist und welcher bleiben soll. Nennt Plunk einen
   Unternamen (z. B. `bounce`), gibt es keinen Konflikt.
5. Optional, aber von Gmail und Outlook erwartet: TXT auf `_dmarc` mit
   `v=DMARC1; p=none;`.
6. In Plunk **Verify** klicken. Meist wenige Minuten, bei zähem Cache länger.
7. Prüfen:

   ```bash
   dig +short TXT voulez.love; dig +short MX voulez.love
   ```

## Fertig, wenn

- `dig +short voulez.love` eine Vercel-Adresse zurückgibt
- Plunk die Domain als **verified** führt
- eine Testmail aus dem Tresor ankommt und nicht im Spam landet

Schlägt der Versand danach immer noch fehl, steht der Grund im Server-Log:
`[mail] Plunk hat abgelehnt (…) — from="Voulez <post@voulez.love>"`.

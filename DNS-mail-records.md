# SPF, MX und DMARC in der Zone voulez.love

Ergänzung zu [DNS.md](DNS.md). Dort steht, was anzulegen ist; hier steht,
warum drei bestehende Einträge dabei im Weg stehen und in welcher Reihenfolge
man sie anfasst.

## Ausgangslage

Stand nach der Einrichtung in Vercel und Plunk:

```
A      voulez.love           216.198.79.1              (Vercel)
CNAME  www                   …vercel-dns-017.com       (Vercel)
TXT    voulez.love           "v=spf1 -all"             ← Altlast
MX     voulez.love           10 inbound-smtp.eu-north-1.amazonaws.com
TXT    _dmarc                "v=DMARC1; p=none;"
CNAME  <3 Selektoren>._domainkey  → …dkim.amazonses.com   (Plunk, DKIM)
MX     plunk.voulez.love     10 feedback-smtp.eu-north-1.amazonses.com
TXT    plunk.voulez.love     "v=spf1 include:amazonses.com ~all"
```

Der entscheidende Punkt steht in den letzten zwei Zeilen: Plunk sendet mit
einer eigenen **MAIL-FROM-Domain**, `plunk.voulez.love`. Dort liegen der
Rückläufer-MX und der SPF-Eintrag, der zählt.

## Fallstrick 1 — der SPF-Eintrag auf der Wurzel

SPF ist eine Liste der Server, die im Namen einer Domain senden dürfen —
und geprüft wird sie gegen den **Umschlag-Absender** (Envelope/Return-Path),
nicht gegen das `From:` im Kopf der Mail. Genau daran hängt hier alles:

- Umschlag-Absender ist `…@plunk.voulez.love`
- also gilt der SPF-Eintrag auf `plunk.voulez.love`
- der Eintrag auf der Wurzel wird für Voulez-Mails gar nicht gelesen

`v=spf1 -all` auf der Wurzel blockiert den Versand also **nicht**. Es ist
trotzdem eine Altlast: die Zeile bedeutet „von dieser Domain sendet niemand",
und das stimmt nur, solange wirklich jede Mail über die Unterdomain läuft.

**Eine Domain darf genau einen SPF-Eintrag haben.** Zwei TXT-Einträge mit
`v=spf1` sind kein „beides gilt", sondern ein `PermError`: die prüfende
Gegenstelle wertet das als kaputt, und beide sind wertlos. Der Eintrag auf
`plunk.voulez.love` ist davon nicht betroffen — das ist ein eigener Name mit
einem eigenen SPF-Eintrag, kein zweiter für die Wurzel.

Drei Möglichkeiten, in dieser Reihenfolge:

| | Wurzel-SPF | Wirkung |
|---|---|---|
| **empfohlen** | `v=spf1 include:amazonses.com ~all` | sendet etwas doch einmal mit Wurzel-Umschlag, geht es durch |
| in Ordnung | Eintrag löschen | kein Ergebnis statt einer Aussage; manche Empfänger rechnen das leicht negativ an |
| brüchig | `v=spf1 -all` behalten | maximal streng, scheitert hart an dem Tag, an dem doch etwas über die Wurzel geht |

Zum Abschluss `~all` (Softfail) statt `-all` (Hardfail): eine falsch
zugeordnete Mail landet so im Spam statt im Nichts.

Wichtig ist bei allen drei Varianten dasselbe: **DMARC besteht hier über
DKIM**, nicht über SPF. Die Signaturschlüssel liegen auf der Wurzel
(`d=voulez.love`), damit passt die Signatur zum `From:` — unabhängig davon,
was der SPF-Eintrag der Wurzel sagt.

Prüfen — es darf **genau eine** Zeile mit `v=spf1` je Name erscheinen:

```bash
dig +short TXT voulez.love; dig +short TXT plunk.voulez.love
```

## Fallstrick 2 — der MX auf der Wurzel

`inbound-smtp.eu-north-1.amazonaws.com` ist der Posteingangs-Endpunkt von
Amazon SES in Stockholm. Er nimmt Mail entgegen, die an `@voulez.love`
adressiert ist. Wer ihn eingetragen hat und ob dahinter noch etwas hängt,
sagt der Eintrag selbst nicht.

Wichtig ist die Unterscheidung zweier Rollen, die beide „MX" heissen:

| Rolle | Wofür | Wo Plunk sie hinhaben will |
|---|---|---|
| Bounce-Feedback | Rückläufer und Beschwerden zu **gesendeter** Mail | gehört zur Domain-Verifizierung |
| Inbound | Mail, die an die Domain **geschickt** wird | optional, eigener Eintrag |

**Mehrere MX-Einträge auf demselben Namen verteilen die Zustellung, sie
addieren sich nicht.** Bei gleicher Priorität wählt der Absender einen aus;
bei verschiedener ist der zweite nur der Ausfallweg. Zwei Anbieter
nebeneinander heisst also: mal landet die Post hier, mal dort — der Grund,
weshalb hier zuerst eine Entscheidung fällt und nicht ein Eintrag.

**Aufgelöst hat sich das von selbst:** Plunk hat seinen Rückläufer-MX auf
`plunk.voulez.love` gelegt, nicht auf die Wurzel. Die beiden Einträge stehen
damit auf verschiedenen Namen und kommen sich nicht in die Quere:

```
MX  voulez.love          10 inbound-smtp.eu-north-1.amazonaws.com   (Empfang)
MX  plunk.voulez.love    10 feedback-smtp.eu-north-1.amazonses.com  (Rückläufer)
```

Der Eintrag auf der Wurzel bleibt also stehen. Offen ist nur, ob dahinter
noch etwas hängt — wer Post an `@voulez.love` heute tatsächlich liest, sagt
der Eintrag nicht. Im Zweifel nicht anfassen: ein überflüssiger MX schadet
niemandem, ein gelöschter Posteingang schon.

Die Regel dahinter bleibt für später wichtig: **mehrere MX-Einträge auf
demselben Namen verteilen die Zustellung, sie addieren sich nicht.** Bei
gleicher Priorität wählt der Absender einen aus, bei verschiedener ist der
zweite nur der Ausfallweg. Zwei Anbieter auf einem Namen heisst: mal landet
die Post hier, mal dort.

## DMARC

`_dmarc.voulez.love` stand auf `v=DMARC1; p=reject;` — der schärfsten Stufe:
Mail, die nicht per DKIM oder SPF zur Domain passt, wird nicht aussortiert,
sondern abgelehnt. Kein Spam-Ordner, keine Kopie, nichts zum Nachschauen.
Das trifft auch jeden Zwischenstand beim Umbau, etwa die Stunde, in der die
DKIM-Einträge zwar gesetzt, aber noch nicht überall sichtbar sind.

Steht inzwischen auf `p=none` — richtig für die Umstellung. Zurück auf
`p=quarantine` oder `p=reject` erst, wenn Testmails zuverlässig ankommen.

## Was noch offen ist

1. Wurzel-SPF: `v=spf1 -all` durch `v=spf1 include:amazonses.com ~all`
   ersetzen (oder löschen, siehe Tabelle oben).
2. In Plunk **Verify** klicken, falls noch nicht geschehen.
3. Testmail aus einem Tresor — sie muss im Posteingang landen, nicht im Spam.
4. `_dmarc` wieder verschärfen, wenn 3 mehrfach geklappt hat.

## Prüfen

```bash
dig +short TXT voulez.love; dig +short TXT plunk.voulez.love
dig +short TXT _dmarc.voulez.love
dig +short MX voulez.love; dig +short MX plunk.voulez.love
```

Erwartet: je Name höchstens eine `v=spf1`-Zeile, ein DMARC-Eintrag in der
gewünschten Stufe, und die beiden MX-Einträge auf getrennten Namen.

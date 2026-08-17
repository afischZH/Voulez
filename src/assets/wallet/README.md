# Bilder für den Apple-Wallet-Pass

Diese fünf PNGs wandern unverändert in jedes `.pkpass`. Sie liegen hier und
nicht in `public/`, weil sie ins Bündel der Serverless-Funktion gehören und
nicht öffentlich ausgeliefert werden sollen. Damit Vercel sie mitnimmt, zählt
`next.config.ts` sie unter `outputFileTracingIncludes` auf.

| Datei          | Grösse  |                                                    |
| -------------- | ------- | -------------------------------------------------- |
| `icon.png`     | 29×29   | Pflicht — ohne Icon lehnt Wallet den Pass ab       |
| `icon@2x.png`  | 58×58   | Pflicht                                            |
| `icon@3x.png`  | 87×87   | empfohlen                                          |
| `logo.png`     | 160×50  | Pflicht — oben links, neben `organizationName`     |
| `logo@2x.png`  | 320×100 | Pflicht                                            |

**Der aktuelle Stand ist ein Platzhalter**: ein Messing-„V" auf Tinte, damit
die Kette vom Bild bis zur Signatur überhaupt prüfbar ist. Vor dem ersten
echten Pass gehört hier die Wortmarke hin.

Beim Austausch zwei Dinge beachten:

- **Die Grössen exakt einhalten.** Wallet skaliert nicht, es lehnt ab.
- **Undurchsichtig exportieren.** Der Passhintergrund ist `rgb(10, 13, 19)`
  (`--color-ink`); ein transparentes Logo zeigt auf manchen Geräten die
  Systemfarbe darunter.

`strip.png` und `thumbnail.png` fehlen mit Absicht: ein Strip-Bild ändert das
Layout des Event-Tickets — die Primärfelder liegen dann darüber — und bindet
den Pass an genau ein Primärfeld.

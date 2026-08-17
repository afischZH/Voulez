# Bilder für den Apple-Wallet-Pass

Diese fünf PNGs wandern unverändert in jedes `.pkpass`. Sie liegen hier und
nicht in `public/`, weil sie ins Bündel der Serverless-Funktion gehören und
nicht öffentlich ausgeliefert werden sollen. Damit Vercel sie mitnimmt, zählt
`next.config.ts` sie unter `outputFileTracingIncludes` auf.

| Datei         | Grösse  |                                                |
| ------------- | ------- | ---------------------------------------------- |
| `icon.png`    | 29×29   | Pflicht — ohne Icon lehnt Wallet den Pass ab   |
| `icon@2x.png` | 58×58   | Pflicht                                        |
| `icon@3x.png` | 87×87   | empfohlen                                      |
| `logo.png`    | 50×50   | Pflicht — oben links, neben `organizationName` |
| `logo@2x.png` | 100×100 | Pflicht                                        |

Alle fünf entstehen aus `Media/Voulez_Logo.png` (1024×1024, transparent):

```bash
sips -c 460 460 Media/Voulez_Logo.png --out /tmp/k.png
sips -s format png -z  29  29 /tmp/k.png --out src/assets/wallet/icon.png
sips -s format png -z  58  58 /tmp/k.png --out src/assets/wallet/icon@2x.png
sips -s format png -z  87  87 /tmp/k.png --out src/assets/wallet/icon@3x.png
sips -s format png -z  50  50 /tmp/k.png --out src/assets/wallet/logo.png
sips -s format png -z 100 100 /tmp/k.png --out src/assets/wallet/logo@2x.png
```

Der Ausschnitt auf 460 px ist der Grund, warum das hier steht: das vollständige
Medaillon hat einen äusseren Ring mit zwölf feinen Strichen, und die zerfallen
bei 29 px zu Grau. Der Ausschnitt zeigt den inneren Ring mit V und Herz — das
bleibt lesbar. Grösser schneiden geht nicht: die Striche liegen auf einem Kreis,
den ein quadratischer Ausschnitt nicht verlassen kann, ohne den Ring mitzunehmen.

Für Google Wallet gilt das nicht — dort wird das **vollständige** Logo in
1024×1024 hinterlegt, weil es dort gross angezeigt wird.

Beim Austausch zwei Dinge beachten:

- **Die Grössen exakt einhalten.** Wallet skaliert nicht, es lehnt ab.
- **Transparenz erhalten.** Der Passhintergrund ist `rgb(10, 13, 19)`
  (`--color-ink`), und das Gold steht direkt darauf. Ein Export mit weisser
  Fläche ergäbe einen hellen Klotz auf dunklem Grund.

`strip.png` und `thumbnail.png` fehlen mit Absicht: ein Strip-Bild ändert das
Layout des Event-Tickets — die Primärfelder liegen dann darüber — und bindet
den Pass an genau ein Primärfeld.

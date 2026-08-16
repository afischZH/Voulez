import 'server-only'

import { escapeHtml } from '@/lib/mail'

/**
 * Die Einladung an den Empfänger — die einzige Voulez-Mail, die jemand
 * bekommt, der die Seite noch nie gesehen hat.
 *
 * Deshalb ist sie als einzige gestaltet: sie muss in den zwei Sekunden vor dem
 * Klick erklären, dass hier jemand Bestimmtes etwas Bestimmtes von einem will,
 * und nicht ein Newsletter. Sie trägt genau drei Angaben aus dem Tresor — den
 * Namen des Empfängers, den Namen des Absenders und den ersten Satz, den der
 * Ersteller geschrieben hat. Der Inhalt des Tresors steht bewusst nicht darin:
 * dafür ist die Tür da.
 *
 * Tabellen und Inline-Styles statt Flexbox und Klassen, weil Mail-Clients
 * nichts anderes zuverlässig können. Outlook kennt kein `border-radius` — die
 * Ecken werden dort eckig, sonst bleibt alles stehen.
 */
export type Invitation = {
  recipientName: string
  /** Der Ersteller. Optional — er darf anonym bleiben. */
  senderName: string | null
  /** „Erster Satz" aus dem Wizard. Optional, dann steht hier der Ersatz. */
  introText: string | null
  /** Die Adresse des Tresors. */
  url: string
  /** Wohin sich Empfänger wenden, die das nicht bekommen wollten. */
  reportUrl: string
}

const INK = '#0a0d13'
const CARD = '#11151e'
const LINE = '#2a3243'
const BRASS = '#c8a44d'
const BRASS_BRIGHT = '#ecd394'
const BRASS_DIM = '#9a7c33'
const PARCHMENT = '#f3ece0'
const FOG = '#99a1b3'
const FOG_DIM = '#737e93'

/** Cinzel gibt es im Postfach nicht. Georgia ist die nächstbeste Gravur. */
const SERIF = "Georgia,'Times New Roman',serif"

/**
 * „Für …" in Handschrift. Webfonts scheiden aus — Gmail lädt keine, und eine
 * Schrift, die nur bei der Hälfte ankommt, ist keine Gestaltung. Also die
 * Handschriften, die auf den Geräten ohnehin liegen.
 *
 * Bewusst die gedruckten und nicht die geschwungenen: Bradley Hand auf macOS
 * und iOS, Ink Free auf Windows 10, Segoe Print davor. Sie sehen nach Stift
 * aus, nicht nach Kalligrafie — daneben steht ein Tresor, keine Hochzeit.
 */
const SCRIPT =
  "'Bradley Hand','Bradley Hand ITC','Ink Free','Segoe Print','Noteworthy',cursive"
const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif"
const MONO = "'SFMono-Regular',Consolas,'Liberation Mono',Menlo,monospace"

const FALLBACK_INTRO =
  'Hinter dieser Tür liegt eine Frage. Die Kombination steht nirgends — sie ergibt sich aus ein paar Rätseln.'

export function invitationMail(invitation: Invitation): {
  subject: string
  text: string
  html: string
} {
  const sender = invitation.senderName?.trim() || 'Jemand'
  const intro = invitation.introText?.trim() || FALLBACK_INTRO
  const name = invitation.recipientName.trim()

  return {
    subject: `${sender} hat dir einen Tresor hinterlassen`,
    // Die Fassung fürs Log, wenn kein Versand eingerichtet ist — und die
    // Vorlage dafür, was das HTML sagt.
    text: [
      `Für ${name}`,
      '',
      intro,
      '',
      `— ${sender}`,
      '',
      `Tresor öffnen: ${invitation.url}`,
      '',
      `Der Tresor bleibt 90 Tage stehen, danach wird alles gelöscht.`,
      `Du weisst nichts davon? Dann ignoriere diese Nachricht — oder melde sie:`,
      invitation.reportUrl,
    ].join('\n'),
    html: html(invitation, { sender, intro, name }),
  }
}

/**
 * Die Abwehr gegen den Dunkelmodus der Postfächer.
 *
 * Apple Mail, Outlook.com und Gmail rechnen die Farben einer Mail um, wenn sie
 * sie für ein helles Layout halten — und das taten sie hier: der Fliesstext
 * (helles Pergament) kam dunkel an, die Messingtöne und die Hintergründe
 * blieben stehen. Ergebnis: fast schwarze Schrift auf fast schwarzem Grund.
 *
 * Drei Lagen dagegen, weil kein Client alle drei versteht:
 *
 * 1. `color-scheme` sagt Apple Mail: diese Mail kann Dunkelmodus selbst, Finger
 *    weg. Das allein löst den Fall auf iPhone und Mac.
 * 2. Die Regeln im Dunkelmodus setzen unsere Farben noch einmal mit
 *    `!important` — für Clients, die trotz Punkt 1 umrechnen.
 * 3. `[data-ogsc]` ist der Haken, den Outlook.com an umgefärbte Elemente
 *    hängt; darüber lassen sich seine Änderungen zurückholen.
 *
 * Bleibt ein Client, der weder Punkt 1 noch 2 noch 3 kennt und trotzdem
 * umfärbt, hilft die vierte Lage im Markup: jede Textzelle trägt ihre
 * Hintergrundfarbe selbst. Wer den Grund kennt, rechnet die Schrift darauf
 * passend um statt blind.
 */
function darkModeStyles(): string {
  const rules: { selectors: string[]; declaration: string }[] = [
    { selectors: ['.v-light'], declaration: `color:${PARCHMENT}!important` },
    { selectors: ['.v-muted', '.v-muted a'], declaration: `color:${FOG}!important` },
    { selectors: ['.v-dim', '.v-dim a'], declaration: `color:${FOG_DIM}!important` },
    { selectors: ['.v-brass'], declaration: `color:${BRASS}!important` },
    { selectors: ['.v-brass-dim'], declaration: `color:${BRASS_DIM}!important` },
    { selectors: ['.v-brass-bright'], declaration: `color:${BRASS_BRIGHT}!important` },
    { selectors: ['.v-card'], declaration: `background-color:${CARD}!important` },
    { selectors: ['.v-ink'], declaration: `background-color:${INK}!important` },
    { selectors: ['.v-button'], declaration: `background-color:${BRASS}!important` },
    { selectors: ['.v-button-text'], declaration: `color:${INK}!important` },
  ]

  const write = (prefix: string) =>
    rules
      .map(
        ({ selectors, declaration }) =>
          `${selectors.map((s) => `${prefix}${s}`).join(',')}{${declaration}}`,
      )
      .join('')

  return [
    `<style type="text/css">`,
    `:root{color-scheme:light dark;supported-color-schemes:light dark;}`,
    `@media (prefers-color-scheme:dark){${write('')}}`,
    // Jeder Selektor der Gruppe braucht den Haken einzeln — sonst gilt die
    // zweite Hälfte der Regel überall statt nur in Outlooks Dunkelmodus.
    write('[data-ogsc] '),
    `</style>`,
  ].join('')
}

/**
 * Ein Textblock, der seine Farbe dreifach trägt: als Klasse für die Regeln
 * oben, als Inline-Stil am `span` und im alten `font`-Element.
 *
 * Der Grund steht im Testprotokoll: dasselbe Postfach hat in drei aufeinander
 * folgenden Mails jeweils genau einen Block umgefärbt — mal die Anrede, mal
 * den Fliesstext — obwohl beide identisch ausgezeichnet waren. Welche Lage ein
 * Client stehen lässt, ist nicht vorhersagbar; eine davon genügt, und `font`
 * ist die einzige, die kein Dunkelmodus-Filter anfasst.
 */
function inked(options: {
  className: string
  color: string
  style: string
  content: string
  /** Nur wo sie zählt — `font` kennt keine Pixel, nur Stufen von 1 bis 7. */
  face?: string
  size?: number
}): string {
  const attributes = [
    `color="${options.color}"`,
    ...(options.face ? [`face="${options.face}"`] : []),
    ...(options.size ? [`size="${options.size}"`] : []),
  ].join(' ')
  return (
    `<font ${attributes}>` +
    `<span class="${options.className}" style="${options.style}color:${options.color};">` +
    `${options.content}</span></font>`
  )
}

function html(
  invitation: Invitation,
  parts: { sender: string; intro: string; name: string },
): string {
  const name = escapeHtml(parts.name)
  const sender = escapeHtml(parts.sender)
  // Der erste Satz darf mehrzeilig eingegeben worden sein.
  const intro = escapeHtml(parts.intro).split('\n').join('<br />')
  const url = escapeHtml(invitation.url)
  const reportUrl = escapeHtml(invitation.reportUrl)

  return [
    darkModeStyles(),

    // Vorschautext: was im Postfach neben dem Betreff steht, bevor jemand
    // öffnet. Ohne ihn zeigen die Clients den Anfang des Codes.
    `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">`,
    `${intro}</div>`,

    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"`,
    ` bgcolor="${INK}" class="v-ink" style="background-color:${INK};margin:0;`,
    `padding:28px 12px;">`,
    `<tr><td align="center" bgcolor="${INK}" class="v-ink" style="background-color:${INK};">`,

    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"`,
    ` bgcolor="${CARD}" class="v-card" style="max-width:520px;background-color:${CARD};`,
    `border:1px solid ${LINE};border-radius:16px;">`,

    // Kopf: die Marke, klein und eingraviert.
    `<tr><td align="center" bgcolor="${CARD}" class="v-card v-brass-dim"`,
    ` style="background-color:${CARD};padding:34px 32px 0;font-family:${SANS};`,
    `font-size:11px;letter-spacing:0.42em;text-transform:uppercase;color:${BRASS_DIM};">`,
    inked({
      className: 'v-brass-dim',
      color: BRASS_DIM,
      style: `font-family:${SANS};font-size:11px;letter-spacing:0.42em;text-transform:uppercase;`,
      content: 'Voulez',
    }),
    `</td></tr>`,

    // Die Anrede in Handschrift — das einzige Element hier, das nicht nach
    // Tresor aussieht, sondern nach jemandem, der etwas geschrieben hat.
    `<tr><td align="center" bgcolor="${CARD}" class="v-card v-brass-bright"`,
    ` style="background-color:${CARD};padding:30px 32px 0;font-family:${SCRIPT};`,
    `font-size:34px;line-height:1.3;color:${BRASS_BRIGHT};">`,
    inked({
      className: 'v-brass-bright',
      color: BRASS_BRIGHT,
      style: `font-family:${SCRIPT};font-size:34px;line-height:1.3;`,
      content: `Für ${name}`,
      face: 'Bradley Hand, Segoe Print, cursive',
      size: 6,
    }),
    `</td></tr>`,

    // Art-déco-Trennlinie mit Raute in der Mitte.
    `<tr><td bgcolor="${CARD}" class="v-card" style="background-color:${CARD};`,
    `padding:24px 44px 0;">`,
    `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>`,
    `<td style="border-bottom:1px solid ${LINE};font-size:0;line-height:0;">&nbsp;</td>`,
    `<td width="30" align="center" class="v-brass"`,
    ` style="font-size:14px;line-height:14px;color:${BRASS};">`,
    inked({
      className: 'v-brass',
      color: BRASS,
      style: 'font-size:14px;line-height:14px;',
      content: '&#9670;',
    }),
    `</td>`,
    `<td style="border-bottom:1px solid ${LINE};font-size:0;line-height:0;">&nbsp;</td>`,
    `</tr></table></td></tr>`,

    // Der erste Satz — der eigentliche Grund dieser Mail.
    `<tr><td align="center" bgcolor="${CARD}" class="v-card v-light"`,
    ` style="background-color:${CARD};padding:24px 40px 0;font-family:${SERIF};`,
    `font-size:17px;line-height:1.68;color:${PARCHMENT};">`,
    inked({
      className: 'v-light',
      color: PARCHMENT,
      style: `font-family:${SERIF};font-size:17px;line-height:1.68;`,
      content: intro,
      face: 'Georgia, serif',
      size: 4,
    }),
    `</td></tr>`,

    `<tr><td align="right" bgcolor="${CARD}" class="v-card v-brass"`,
    ` style="background-color:${CARD};padding:18px 40px 0;font-family:${SERIF};`,
    `font-size:15px;font-style:italic;color:${BRASS};">`,
    inked({
      className: 'v-brass',
      color: BRASS,
      style: `font-family:${SERIF};font-size:15px;font-style:italic;`,
      content: `— ${sender}`,
      face: 'Georgia, serif',
    }),
    `</td></tr>`,

    // Der Knopf. `bgcolor` am <td> statt nur im Style: sonst steht in Outlook
    // schwarze Schrift auf schwarzem Grund.
    `<tr><td align="center" bgcolor="${CARD}" class="v-card"`,
    ` style="background-color:${CARD};padding:32px 32px 0;">`,
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center">`,
    `<tr><td align="center" bgcolor="${BRASS}" class="v-button"`,
    ` style="background-color:${BRASS};border-radius:9px;">`,
    `<a href="${url}" class="v-button-text"`,
    ` style="display:inline-block;padding:15px 34px;font-family:${SANS};`,
    `font-size:13px;font-weight:bold;letter-spacing:0.16em;text-transform:uppercase;`,
    `color:${INK};text-decoration:none;">`,
    `<font color="${INK}"><span class="v-button-text" style="color:${INK};">`,
    `Tresor öffnen</span></font></a>`,
    `</td></tr></table></td></tr>`,

    // Für Postfächer, die Knöpfe verschlucken, und für alle, die lieber sehen,
    // wohin ein Link führt, bevor sie ihn anfassen.
    `<tr><td align="center" bgcolor="${CARD}" class="v-card v-dim"`,
    ` style="background-color:${CARD};padding:16px 32px 0;font-family:${MONO};`,
    `font-size:12px;line-height:1.6;color:${FOG_DIM};word-break:break-all;">`,
    inked({
      className: 'v-dim',
      color: FOG_DIM,
      style: `font-family:${MONO};font-size:12px;line-height:1.6;word-break:break-all;`,
      content:
        `<a href="${url}" class="v-dim" style="color:${FOG_DIM};` +
        `text-decoration:none;">${url}</a>`,
    }),
    `</td></tr>`,

    `<tr><td bgcolor="${CARD}" class="v-card" style="background-color:${CARD};`,
    `padding:30px 32px 0;"><div style="border-top:1px solid ${LINE};`,
    `font-size:0;line-height:0;">&nbsp;</div></td></tr>`,

    `<tr><td align="center" bgcolor="${CARD}" class="v-card v-muted"`,
    ` style="background-color:${CARD};padding:20px 32px 32px;font-family:${SANS};`,
    `font-size:12px;line-height:1.7;color:${FOG};">`,
    inked({
      className: 'v-muted',
      color: FOG,
      style: `font-family:${SANS};font-size:12px;line-height:1.7;`,
      content:
        `Der Tresor bleibt 90 Tage stehen, danach wird alles gelöscht.<br />` +
        `Du weisst nichts davon? Dann ignorier diese Nachricht — oder ` +
        `<a href="${reportUrl}" class="v-muted" style="color:${FOG};` +
        `text-decoration:underline;">meld sie uns</a>.`,
    }),
    `</td></tr>`,

    `</table>`,

    `<div class="v-dim" style="max-width:520px;padding:18px 8px 0;font-family:${SANS};`,
    `font-size:11px;letter-spacing:0.06em;color:${FOG_DIM};">`,
    inked({
      className: 'v-dim',
      color: FOG_DIM,
      style: `font-family:${SANS};font-size:11px;letter-spacing:0.06em;`,
      content: 'Voulez — eine Einladung hinter Schloss und Riegel.',
    }),
    `</div>`,

    `</td></tr></table>`,
  ].join('')
}

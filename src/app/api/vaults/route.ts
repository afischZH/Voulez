import { customAlphabet } from 'nanoid'
import { hashPin, hashToken, newToken } from '@/lib/crypto'
import { draftSchema, pinFor, type Draft } from '@/lib/draft'
import { env } from '@/lib/env'
import { errors, fail, ok } from '@/lib/http'
import { send } from '@/lib/mail'
import { puzzleFor } from '@/lib/puzzles'
import { allow, clientFingerprint, LIMITS } from '@/lib/rate-limit'
import { db } from '@/lib/supabase/server'
import { formatDay } from '@/lib/time'

// Ohne Vokale und ohne verwechselbare Zeichen — der Link wird auch mal
// abgetippt oder vorgelesen.
const makeSlug = customAlphabet('23456789abcdefghjkmnpqrstuvwxyz', 8)

export async function POST(request: Request) {
  const permitted = await allow(
    `create:${clientFingerprint(request)}`,
    LIMITS.create.limit,
    LIMITS.create.windowSeconds,
  )
  if (!permitted) {
    return errors.tooMany(LIMITS.create.windowSeconds)
  }

  const draft = draftSchema.safeParse(await request.json().catch(() => null))
  if (!draft.success) {
    return errors.badRequest('Der Entwurf ist unvollständig.')
  }

  // Jede Rätsel-Konfiguration muss zu ihrem Typ passen — sonst liegt später
  // ein Tresor in der Datenbank, den niemand spielen kann.
  const puzzles = []
  for (const puzzle of draft.data.puzzles) {
    const definition = puzzleFor(puzzle.kind)
    if (!definition) return errors.badRequest(`Unbekannter Rätseltyp: ${puzzle.kind}`)

    const config = definition.configSchema.safeParse(puzzle.config)
    if (!config.success) {
      return errors.badRequest(`"${puzzle.title || puzzle.kind}" ist nicht fertig.`)
    }
    puzzles.push({ ...puzzle, config: config.data })
  }

  const editToken = newToken()
  const confirmToken = newToken()

  const { data: vault, error } = await db()
    .from('vaults')
    .insert({
      slug: makeSlug(),
      pin_hash: await hashPin(pinFor(draft.data.puzzles)),
      pin_length: draft.data.puzzles.length,
      edit_token_hash: hashToken(editToken),
      confirm_token_hash: hashToken(confirmToken),
      creator_email: draft.data.creatorEmail,
      creator_name: draft.data.creatorName || null,
      recipient_name: draft.data.recipientName,
      intro_text: draft.data.introText || null,
      reveal_text: draft.data.revealText,
      closing_text: draft.data.closingText || null,
      timezone: draft.data.timezone,
      allow_custom_proposal: draft.data.allowCustomProposal,
      // Erst nach dem Klick in der E-Mail wird der Tresor spielbar. Ohne diese
      // Sperre könnte man fremde Adressen eintragen und die Seite als
      // Versandwerkzeug missbrauchen.
      status: 'draft',
    })
    .select('id, slug')
    .single()

  if (error || !vault) {
    console.error('Tresor konnte nicht angelegt werden', error)
    return errors.badRequest('Der Tresor konnte nicht angelegt werden.')
  }

  const [puzzleResult, optionResult, slotResult] = await Promise.all([
    db()
      .from('vault_puzzles')
      .insert(
        puzzles.map((puzzle, index) => ({
          vault_id: vault.id,
          type: puzzle.kind,
          position: index + 1,
          title: puzzle.title || null,
          hint_text: puzzle.hint || null,
          reveal_digit: puzzle.digit,
          config: puzzle.config as never,
        })),
      ),
    db()
      .from('date_options')
      .insert(
        draft.data.options.map((option, index) => ({
          vault_id: vault.id,
          label: option.label,
          description: option.description || null,
          position: index + 1,
        })),
      ),
    db()
      .from('date_slots')
      .insert(
        draft.data.slots.map((slot) => ({
          vault_id: vault.id,
          day: slot.day,
          time_from: slot.from,
          time_to: slot.to,
        })),
      ),
  ])

  const failure = puzzleResult.error ?? optionResult.error ?? slotResult.error
  if (failure) {
    console.error('Tresor-Inhalte fehlgeschlagen, rolle zurück', failure)
    await db().from('vaults').delete().eq('id', vault.id)
    return errors.badRequest('Der Tresor konnte nicht angelegt werden.')
  }

  const mail = await send({
    to: draft.data.creatorEmail,
    subject: `Bestätige deinen Tresor für ${draft.data.recipientName}`,
    text: [
      `Fast fertig. Ein Klick, und dein Tresor geht online:`,
      '',
      `${env.siteUrl}/bestaetigen?token=${confirmToken}`,
      '',
      `Danach bekommst du den Link zum Teilen und einen Verwaltungslink.`,
      `Hebe diese E-Mail auf — der Verwaltungslink steht nur hier:`,
      `${env.siteUrl}/verwalten?token=${editToken}`,
      ...(draft.data.emailSummary ? summaryLines(draft.data) : []),
      '',
      `Wenn du das nicht warst, ignoriere diese Nachricht. Ohne Bestätigung`,
      `wird der Tresor nie sichtbar und nach 90 Tagen gelöscht.`,
    ].join('\n'),
  })

  // Diese eine Mail darf nicht stillschweigend scheitern. Sie trägt die
  // beiden einzigen Tokens, die es je geben wird: ohne sie ist der Tresor
  // ein Entwurf, den niemand mehr bestätigen und niemand mehr verwalten
  // kann. Ein "Schau in dein Postfach" auf eine Nachricht, die nie kommt,
  // ist schlimmer als ein ehrlicher Fehler — also zurückrollen.
  if (!mail.ok) {
    console.error('Bestätigungsmail nicht zustellbar, rolle Tresor zurück', mail)
    await db().from('vaults').delete().eq('id', vault.id)
    return fail(
      502,
      'mail_failed',
      mail.reason === 'not_configured'
        ? 'Der E-Mail-Versand ist auf diesem Server nicht eingerichtet. Der Tresor wurde nicht angelegt.'
        : 'Die Bestätigungsmail liess sich nicht zustellen. Prüf die Adresse und versuch es nochmal.',
    )
  }

  // Der Slug bleibt bis zur Bestätigung geheim — sonst liesse sich ein
  // unbestätigter Link teilen.
  return ok({ created: true, email: draft.data.creatorEmail })
}

/**
 * Die Angaben als Klartext-Block für die Bestätigungsmail — dieselben Zeilen,
 * die der Wizard nach dem Abschicken anzeigt. Enthält die Kombination, steht
 * deshalb nur auf Wunsch in der Mail.
 */
function summaryLines(draft: Draft): string[] {
  return [
    '',
    '— Deine Angaben —',
    '',
    `Für:         ${draft.recipientName}`,
    `Kombination: ${pinFor(draft.puzzles)}`,
    `Rätsel:      ${draft.puzzles.map((p, i) => `${p.digit} — ${p.title || `Rätsel ${i + 1}`}`).join('\n             ')}`,
    `Zur Auswahl: ${draft.options.map((o) => o.label).join(' · ')}`,
    `Eigener Vorschlag: ${
      draft.allowCustomProposal
        ? 'erlaubt — Unternehmung und Zeitpunkt frei'
        : 'nicht erlaubt'
    }`,
    `Zeitfenster: ${draft.slots
      .map((s) => `${formatDay(s.day, draft.timezone)}, ${s.from}–${s.to}`)
      .join('\n             ')}`,
    `Zeitzone:    ${draft.timezone}`,
    '',
    'Im Tresor steht:',
    draft.revealText,
    draft.closingText ? `\n${draft.closingText}` : '',
  ]
}

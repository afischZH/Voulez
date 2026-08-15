import { customAlphabet } from 'nanoid'
import { hashPin, hashToken, newToken } from '@/lib/crypto'
import { draftSchema, pinFor } from '@/lib/draft'
import { env } from '@/lib/env'
import { errors, ok } from '@/lib/http'
import { send } from '@/lib/mail'
import { puzzleFor } from '@/lib/puzzles'
import { allow, clientFingerprint, LIMITS } from '@/lib/rate-limit'
import { db } from '@/lib/supabase/server'

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

  await send({
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
      '',
      `Wenn du das nicht warst, ignoriere diese Nachricht. Ohne Bestätigung`,
      `wird der Tresor nie sichtbar und nach 90 Tagen gelöscht.`,
    ].join('\n'),
  })

  // Der Slug bleibt bis zur Bestätigung geheim — sonst liesse sich ein
  // unbestätigter Link teilen.
  return ok({ created: true, email: draft.data.creatorEmail })
}

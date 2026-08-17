import 'server-only'

import { db } from '@/lib/supabase/server'
import { puzzleFor } from '@/lib/puzzles'
import type { Json, PlayerConfig } from '@/lib/puzzles/contract'
import type { Tables } from '@/lib/supabase/types'
import { walletFlags, type WalletFlags } from '@/lib/wallet/flags'

export type VaultRow = Tables<'vaults'>
export type PuzzleRow = Tables<'vault_puzzles'>

/** Was der Browser vor dem Öffnen sehen darf. Mehr gibt es nicht. */
export type LockedVault = {
  slug: string
  recipientName: string
  introText: string | null
  pinLength: number
  theme: string
  puzzles: LockedPuzzle[]
}

export type LockedPuzzle = {
  id: string
  kind: string
  position: number
  title: string | null
  hint: string | null
  config: PlayerConfig
}

/** Was nach korrekter PIN dazukommt. */
export type OpenedVault = {
  revealText: string
  closingText: string | null
  /** Wer einlädt — erst nach dem Öffnen relevant, steht auf dem Ticket. */
  hostName: string | null
  timezone: string
  options: { id: string; label: string; icon: string; description: string | null }[]
  slots: { day: string; from: string; to: string }[]
  /** Ob neben der Auswahl auch ein eigener Vorschlag zugelassen ist. */
  allowCustomProposal: boolean
  alreadyAnswered: boolean
  /** Welche Wallet-Knöpfe der Server anbieten kann. Ohne Zertifikate steht
   *  hier `false`, und der Knopf erscheint gar nicht erst. */
  wallet: WalletFlags
}

export type Playable =
  | { ok: true; vault: VaultRow }
  | { ok: false; reason: 'not_found' | 'draft' | 'expired' | 'disabled' | 'answered' }

export async function findVault(slug: string): Promise<VaultRow | null> {
  const { data } = await db().from('vaults').select('*').eq('slug', slug).maybeSingle()
  return data ?? null
}

/** Vom Ticket-Link aus ist nur die ID der Antwort bekannt, nicht der Slug. */
export async function vaultById(id: string): Promise<VaultRow | null> {
  const { data } = await db().from('vaults').select('*').eq('id', id).maybeSingle()
  return data ?? null
}

/**
 * Ein Tresor ist nur spielbar, wenn er bestätigt (`live`), nicht abgelaufen
 * und nicht gesperrt ist. `draft` heisst: die Doppel-Opt-In-Mail wurde noch
 * nicht bestätigt — das verhindert, dass jemand fremde Adressen einträgt.
 */
export function playable(vault: VaultRow | null): Playable {
  if (!vault) return { ok: false, reason: 'not_found' }
  if (vault.status === 'disabled') return { ok: false, reason: 'disabled' }
  if (vault.status === 'draft') return { ok: false, reason: 'draft' }
  if (new Date(vault.expires_at) < new Date()) return { ok: false, reason: 'expired' }
  return { ok: true, vault }
}

export async function lockedView(vault: VaultRow): Promise<LockedVault> {
  const { data: rows } = await db()
    .from('vault_puzzles')
    .select('*')
    .eq('vault_id', vault.id)
    .order('position')

  const puzzles: LockedPuzzle[] = []
  for (const row of rows ?? []) {
    const def = puzzleFor(row.type)
    if (!def) continue

    const parsed = def.configSchema.safeParse(row.config)
    if (!parsed.success) {
      console.error('ungueltige Raetsel-Konfiguration', row.id, parsed.error)
      continue
    }

    puzzles.push({
      id: row.id,
      kind: row.type,
      position: row.position,
      title: row.title,
      hint: row.hint_text,
      // Genau hier wird die Lösung abgeschnitten.
      config: def.toPlayerConfig(parsed.data),
    })
  }

  return {
    slug: vault.slug,
    recipientName: vault.recipient_name,
    introText: vault.intro_text,
    pinLength: vault.pin_length,
    theme: vault.theme,
    puzzles,
  }
}

export async function openedView(vault: VaultRow): Promise<OpenedVault> {
  const [{ data: options }, { data: slots }, { data: answer }] = await Promise.all([
    db()
      .from('date_options')
      .select('id,label,icon,description')
      .eq('vault_id', vault.id)
      .order('position'),
    db()
      .from('date_slots')
      .select('day,time_from,time_to')
      .eq('vault_id', vault.id)
      .order('day')
      .order('time_from'),
    db().from('responses').select('id').eq('vault_id', vault.id).maybeSingle(),
  ])

  return {
    revealText: vault.reveal_text,
    closingText: vault.closing_text,
    hostName: vault.creator_name,
    timezone: vault.timezone,
    options: options ?? [],
    slots: (slots ?? []).map((s) => ({
      day: s.day,
      from: s.time_from,
      to: s.time_to,
    })),
    allowCustomProposal: vault.allow_custom_proposal,
    alreadyAnswered: Boolean(answer),
    wallet: walletFlags(),
  }
}

/** Fire-and-forget. Ein fehlgeschlagenes Log darf den Flow nie blockieren. */
export function logEvent(vaultId: string, kind: string, meta: Json = {}): void {
  void db()
    .from('vault_events')
    .insert({ vault_id: vaultId, kind, meta })
    .then(({ error }) => {
      if (error) console.error('event log failed', error)
    })
}

import 'server-only'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { env } from '@/lib/env'
import type { Database } from '@/lib/supabase/types'

let client: SupabaseClient<Database> | null = null

/**
 * Der einzige Datenbank-Zugang der App. Läuft mit dem Service-Role-Key und
 * umgeht damit RLS — deshalb darf dieses Modul ausschließlich in Route
 * Handlers und Server Components importiert werden. `server-only` sorgt
 * dafür, dass ein versehentlicher Client-Import den Build bricht.
 *
 * Es gibt bewusst keinen Browser-Client: sonst wären `pin_hash` und
 * `vault_puzzles.config` über PostgREST erreichbar und der ganze Clou
 * der Seite wäre in den DevTools nachlesbar.
 */
export function db(): SupabaseClient<Database> {
  client ??= createClient<Database>(env.supabaseUrl, env.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { 'x-application-name': 'voulez' } },
  })
  return client
}

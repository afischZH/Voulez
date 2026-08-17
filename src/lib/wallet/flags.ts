import 'server-only'

/**
 * Welche Wallet-Knöpfe der Server anbieten kann.
 *
 * Bewusst nicht in `env.ts`: dessen Vertrag ist lautes Scheitern bei fehlender
 * Konfiguration. Hier gilt das Gegenteil — die Prüfung läuft beim Rendern der
 * Ticketseite, und eine leere Variable ist dort keine Störung, sondern die
 * Aussage „diesen Knopf gibt es hier nicht“. Dieselbe Trennung nutzt schon
 * `mail.ts`, das `PLUNK_API_KEY` direkt aus `process.env` liest.
 */
export type WalletFlags = { apple: boolean; google: boolean }

const APPLE = [
  'APPLE_PASS_TYPE_ID',
  'APPLE_TEAM_ID',
  'APPLE_PASS_CERT_PEM_BASE64',
  'APPLE_PASS_KEY_PEM_BASE64',
  'APPLE_WWDR_CERT_PEM_BASE64',
] as const

const GOOGLE = [
  'GOOGLE_WALLET_ISSUER_ID',
  'GOOGLE_WALLET_CLIENT_EMAIL',
  'GOOGLE_WALLET_PRIVATE_KEY',
] as const

const set = (name: string) => Boolean(process.env[name]?.trim())

/** Halb konfiguriert zählt als nicht konfiguriert — sonst führt der Knopf ins Leere. */
export function appleConfigured(): boolean {
  return APPLE.every(set)
}

export function googleConfigured(): boolean {
  return GOOGLE.every(set)
}

/** Wirft nie. */
export function walletFlags(): WalletFlags {
  return { apple: appleConfigured(), google: googleConfigured() }
}

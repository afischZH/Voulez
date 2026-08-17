import 'server-only'

/**
 * Serverseitige Umgebungsvariablen.
 *
 * Bewusst kein `NEXT_PUBLIC_`-Prefix: der Browser bekommt weder die Supabase-URL
 * noch einen Key zu sehen. Es gibt keinen Supabase-Client im Browser, weil sonst
 * PIN-Hashes und Rätsel-Lösungen über PostgREST erreichbar wären.
 */
function required(name: string): string {
  const value = process.env[name]
  if (!value) {
    throw new Error(
      `Umgebungsvariable ${name} fehlt. Siehe .env.example für die erwarteten Werte.`,
    )
  }
  return value
}

/** Zertifikate stehen als Base64 in der Umgebung — mehrzeiliges PEM sonst nicht. */
function fromBase64(name: string): string {
  return Buffer.from(required(name), 'base64').toString('utf8')
}

export const env = {
  get supabaseUrl() {
    return required('SUPABASE_URL')
  },
  get supabaseServiceRoleKey() {
    return required('SUPABASE_SERVICE_ROLE_KEY')
  },
  get sessionSecret() {
    return required('SESSION_SECRET')
  },
  get plunkApiKey() {
    return required('PLUNK_API_KEY')
  },
  get mailFrom() {
    return process.env.MAIL_FROM ?? 'Voulez <post@voulez.love>'
  },
  /** Wohin Missbrauchsmeldungen gehen. */
  get reportTo() {
    return required('REPORT_TO')
  },
  get siteUrl() {
    return (process.env.SITE_URL ?? 'http://localhost:3000').replace(/\/$/, '')
  },

  // Wallet-Pässe. Fehlt hier etwas, erscheint der zugehörige Knopf gar nicht
  // erst — geprüft wird das in `wallet/flags.ts`, nicht hier. Wer bis hierher
  // kommt, hat den Knopf gesehen und darf ein lautes Scheitern erwarten.
  get applePassTypeId() {
    return required('APPLE_PASS_TYPE_ID')
  },
  get appleTeamId() {
    return required('APPLE_TEAM_ID')
  },
  get applePassCertPem() {
    return fromBase64('APPLE_PASS_CERT_PEM_BASE64')
  },
  get applePassKeyPem() {
    return fromBase64('APPLE_PASS_KEY_PEM_BASE64')
  },
  get appleWwdrPem() {
    return fromBase64('APPLE_WWDR_CERT_PEM_BASE64')
  },

  get googleWalletIssuerId() {
    return required('GOOGLE_WALLET_ISSUER_ID')
  },
  get googleWalletClientEmail() {
    return required('GOOGLE_WALLET_CLIENT_EMAIL')
  },
  /**
   * Vercel speichert den mehrzeiligen PEM-Schlüssel mit literalen „\n“.
   * Ohne diese Zeile lehnt OpenSSL ihn mit „no start line“ ab — der mit
   * Abstand häufigste Fehler bei diesem Weg.
   */
  get googleWalletPrivateKey() {
    return required('GOOGLE_WALLET_PRIVATE_KEY').replace(/\\n/g, '\n')
  },
  get googleWalletClassSuffix() {
    return process.env.GOOGLE_WALLET_CLASS_SUFFIX ?? 'voulez_einladung_v1'
  },
} as const

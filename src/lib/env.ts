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
} as const

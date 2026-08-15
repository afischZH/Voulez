import type { MetadataRoute } from 'next'

/**
 * Tresore, Verwaltungs- und Bestätigungslinks dürfen nie in einen Index
 * geraten — ein indexierter Tresor wäre eine öffentliche Einladung.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/v/', '/verwalten', '/bestaetigen', '/api/'],
    },
  }
}

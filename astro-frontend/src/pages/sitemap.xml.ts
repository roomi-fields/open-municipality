import type { APIRoute } from 'astro'
import { fetchItems } from '../lib/directus'

const SITE = process.env.SITE_URL || 'https://plateformecitoyennelisloise.fr'

const STATIC_PATHS = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/seances', priority: '0.8', changefreq: 'weekly' },
  { path: '/deliberations', priority: '0.8', changefreq: 'weekly' },
  { path: '/elus', priority: '0.6', changefreq: 'monthly' },
  { path: '/engagements', priority: '0.7', changefreq: 'weekly' },
  { path: '/blog', priority: '0.7', changefreq: 'weekly' },
  { path: '/petitions', priority: '0.6', changefreq: 'weekly' },
  { path: '/signalements', priority: '0.5', changefreq: 'monthly' },
  { path: '/newsletter', priority: '0.4', changefreq: 'yearly' },
  { path: '/mentions-legales', priority: '0.2', changefreq: 'yearly' },
]

export const GET: APIRoute = async () => {
  const [articles, deliberations] = await Promise.all([
    fetchItems('articles', {
      'filter[statut][_eq]': 'publie',
      fields: 'slug,date_publication',
      limit: '500',
    }),
    fetchItems('deliberations', {
      'filter[statut][_eq]': 'publie',
      fields: 'id,seance.date',
      limit: '500',
    }),
  ])

  const urls: string[] = []
  for (const s of STATIC_PATHS) {
    urls.push(`<url><loc>${SITE}${s.path}</loc><changefreq>${s.changefreq}</changefreq><priority>${s.priority}</priority></url>`)
  }
  for (const a of articles) {
    const lastmod = a.date_publication ? new Date(a.date_publication).toISOString().slice(0, 10) : ''
    urls.push(`<url><loc>${SITE}/blog/${a.slug}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>monthly</changefreq><priority>0.6</priority></url>`)
  }
  for (const d of deliberations) {
    const lastmod = d.seance?.date ? new Date(d.seance.date).toISOString().slice(0, 10) : ''
    urls.push(`<url><loc>${SITE}/deliberations/${d.id}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<changefreq>yearly</changefreq><priority>0.5</priority></url>`)
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>`

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  })
}

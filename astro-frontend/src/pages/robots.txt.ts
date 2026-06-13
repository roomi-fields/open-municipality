import type { APIRoute } from 'astro'

const SITE = process.env.SITE_URL || 'https://plateformecitoyennelisloise.fr'

export const GET: APIRoute = async () => {
  const body = `User-agent: *
Allow: /
Disallow: /admin
Disallow: /api/
Disallow: /connexion
Disallow: /mon-espace

Sitemap: ${SITE}/sitemap.xml
`
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}

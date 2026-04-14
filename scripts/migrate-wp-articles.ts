/**
 * Migration des articles WordPress → Directus collection `articles`.
 * Source : https://plateformecitoyennelisloise.fr (ancien site WP)
 */
import { login, getItems, createItem, updateItem } from './lib/directus'

const WP_API = 'https://plateformecitoyennelisloise.fr/?rest_route=/wp/v2/posts&per_page=50'

async function main() {
  console.log('📥 Migration articles WordPress → Directus\n')
  await login()

  console.log(`Fetch ${WP_API}`)
  const resp = await fetch(WP_API)
  if (!resp.ok) throw new Error(`WP HTTP ${resp.status}`)
  const posts: any[] = await resp.json()
  console.log(`${posts.length} articles trouvés\n`)

  const existing = await getItems('articles', 'limit=100&fields=id,slug')
  const bySlug = new Map<string, number>()
  for (const a of existing) bySlug.set(a.slug, a.id)

  let created = 0, updated = 0
  for (const p of posts) {
    const payload = {
      title: p.title?.rendered || '',
      slug: p.slug,
      excerpt: (p.excerpt?.rendered || '').replace(/<[^>]+>/g, '').trim(),
      content: p.content?.rendered || '',
      date_publication: p.date,
      author: p._embedded?.author?.[0]?.name || 'Plateforme Citoyenne',
      statut: p.status === 'publish' ? 'publie' : 'brouillon',
      source_url: p.link,
    }
    const existingId = bySlug.get(p.slug)
    if (existingId) {
      await updateItem('articles', existingId, payload)
      console.log(`  ✏  ${p.title?.rendered}`)
      updated++
    } else {
      await createItem('articles', payload)
      console.log(`  ➕ ${p.title?.rendered}`)
      created++
    }
  }
  console.log(`\n✅ ${created} créés, ${updated} mis à jour`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

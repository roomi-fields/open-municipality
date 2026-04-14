import type { APIRoute } from 'astro'
import { getSessionCookie, directusAdmin } from '../../lib/auth'

export const POST: APIRoute = async ({ request, cookies }) => {
  const me = getSessionCookie(cookies)
  if (!me) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })
  const { commentaire, value } = await request.json()
  const cId = Number(commentaire)
  const v = Number(value)
  if (!cId || ![1, -1].includes(v)) return new Response(JSON.stringify({ error: 'bad params' }), { status: 400 })

  const ex = await directusAdmin('GET', `/items/commentaire_votes?filter[auteur][_eq]=${me.sub}&filter[commentaire][_eq]=${cId}&limit=1`)
  if (ex.data?.[0]) {
    if (ex.data[0].value === v) {
      // Annuler
      await directusAdmin('DELETE', `/items/commentaire_votes/${ex.data[0].id}`)
      return new Response(JSON.stringify({ ok: true, removed: true }), { status: 200 })
    }
    await directusAdmin('PATCH', `/items/commentaire_votes/${ex.data[0].id}`, { value: v })
    return new Response(JSON.stringify({ ok: true, updated: true }), { status: 200 })
  }
  await directusAdmin('POST', '/items/commentaire_votes', { commentaire: cId, auteur: me.sub, value: v })
  return new Response(JSON.stringify({ ok: true, created: true }), { status: 200 })
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const me = getSessionCookie(cookies)
  const ids = new URL(request.url).searchParams.get('ids')
  if (!ids) return new Response(JSON.stringify({ error: 'missing ids' }), { status: 400 })
  const list = ids.split(',').map(Number).filter(Boolean)
  if (!list.length) return new Response(JSON.stringify({ counts: {}, mine: {} }), { status: 200 })

  // Tous les votes pour ces commentaires (calcul agrégé manuel : Directus aggregate sur multiple group_by buggue parfois)
  const all = await directusAdmin('GET', `/items/commentaire_votes?filter[commentaire][_in]=${list.join(',')}&limit=2000&fields=commentaire,value,auteur`)
  const counts: Record<number, { up: number; down: number }> = {}
  const mine: Record<number, number> = {}
  for (const r of all.data || []) {
    const c = r.commentaire
    if (!counts[c]) counts[c] = { up: 0, down: 0 }
    if (r.value === 1) counts[c].up++
    else if (r.value === -1) counts[c].down++
    if (me && r.auteur === me.sub) mine[c] = r.value
  }
  return new Response(JSON.stringify({ counts, mine, authenticated: !!me }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

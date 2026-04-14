import type { APIRoute } from 'astro'
import { getSessionCookie, directusAdmin } from '../../lib/auth'

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = getSessionCookie(cookies)
  if (!user) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })

  let body: any
  try { body = await request.json() } catch { return new Response(JSON.stringify({ error: 'bad json' }), { status: 400 }) }
  const delibId = Number(body.deliberation)
  const choix = String(body.choix)
  if (!delibId || !['pour', 'contre', 'abstention'].includes(choix)) {
    return new Response(JSON.stringify({ error: 'bad params' }), { status: 400 })
  }

  // 1 vote/citoyen/délib : upsert
  const existing = await directusAdmin('GET', `/items/votes_citoyens?filter[utilisateur][_eq]=${user.sub}&filter[deliberation][_eq]=${delibId}&limit=1`)
  if (existing.data?.length) {
    await directusAdmin('PATCH', `/items/votes_citoyens/${existing.data[0].id}`, { choix })
    return new Response(JSON.stringify({ ok: true, updated: true }), { status: 200 })
  }
  await directusAdmin('POST', '/items/votes_citoyens', { utilisateur: user.sub, deliberation: delibId, choix })
  return new Response(JSON.stringify({ ok: true, created: true }), { status: 200 })
}

export const GET: APIRoute = async ({ request, cookies }) => {
  const user = getSessionCookie(cookies)
  const delibId = Number(new URL(request.url).searchParams.get('deliberation'))
  if (!delibId) return new Response(JSON.stringify({ error: 'missing delib' }), { status: 400 })

  const agg = await directusAdmin('GET', `/items/votes_citoyens?filter[deliberation][_eq]=${delibId}&aggregate[count]=choix&groupBy[]=choix`)
  const counts = { pour: 0, contre: 0, abstention: 0 }
  for (const r of agg.data || []) {
    if (r.choix in counts) counts[r.choix as keyof typeof counts] = parseInt(r.count?.choix || '0')
  }

  let myVote: string | null = null
  if (user) {
    const mine = await directusAdmin('GET', `/items/votes_citoyens?filter[utilisateur][_eq]=${user.sub}&filter[deliberation][_eq]=${delibId}&limit=1&fields=choix`)
    myVote = mine.data?.[0]?.choix || null
  }

  return new Response(JSON.stringify({ counts, myVote, authenticated: !!user }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

import type { APIRoute } from 'astro'
import { getSessionCookie, isAdmin, directusAdmin } from '../../../lib/auth'

async function deleteAll(collection: string, filter: string) {
  const r = await directusAdmin('GET', `/items/${collection}?${filter}&limit=500&fields=id`)
  let n = 0
  for (const it of r.data || []) {
    try { await directusAdmin('DELETE', `/items/${collection}/${it.id}`); n++ } catch {}
  }
  return n
}

export const POST: APIRoute = async ({ request, cookies }) => {
  const me = getSessionCookie(cookies)
  if (!isAdmin(me)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })

  const { uid } = await request.json()
  if (!uid) return new Response(JSON.stringify({ error: 'missing uid' }), { status: 400 })
  if (uid === me!.sub) return new Response(JSON.stringify({ error: 'Vous ne pouvez pas supprimer votre propre compte' }), { status: 400 })

  const u = await directusAdmin('GET', `/items/citoyens/${uid}`)
  if (!u.data) return new Response(JSON.stringify({ error: 'introuvable' }), { status: 404 })

  // Cascade : votes citoyens → commentaires (et leurs votes pouce) → magic_tokens → citoyen
  // 1. Supprime les votes pouce de l'utilisateur
  const pouces = await deleteAll('commentaire_votes', `filter[auteur][_eq]=${uid}`)
  // 2. Supprime les pouces sur les commentaires de l'utilisateur (par d'autres)
  const sesComm = await directusAdmin('GET', `/items/commentaires?filter[auteur][_eq]=${uid}&limit=500&fields=id`)
  let poucesSur = 0
  for (const c of sesComm.data || []) {
    poucesSur += await deleteAll('commentaire_votes', `filter[commentaire][_eq]=${c.id}`)
  }
  // 3. Supprime ses commentaires
  const comms = await deleteAll('commentaires', `filter[auteur][_eq]=${uid}`)
  // 4. Supprime ses votes citoyens
  const votes = await deleteAll('votes_citoyens', `filter[utilisateur][_eq]=${uid}`)
  // 5. Supprime ses magic_tokens
  const tokens = await deleteAll('magic_tokens', `filter[citoyen][_eq]=${uid}`)
  // 6. Supprime le compte
  await directusAdmin('DELETE', `/items/citoyens/${uid}`)

  return new Response(JSON.stringify({
    ok: true,
    deleted: { pouces, poucesSur, comms, votes, tokens },
    pseudo: u.data.pseudo,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

// GET pour pré-visualiser ce qui sera supprimé
export const GET: APIRoute = async ({ request, cookies }) => {
  const me = getSessionCookie(cookies)
  if (!isAdmin(me)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })
  const uid = new URL(request.url).searchParams.get('uid')
  if (!uid) return new Response(JSON.stringify({ error: 'missing uid' }), { status: 400 })

  const [u, comm, votes] = await Promise.all([
    directusAdmin('GET', `/items/citoyens/${uid}?fields=pseudo,email`),
    directusAdmin('GET', `/items/commentaires?filter[auteur][_eq]=${uid}&aggregate[count]=id`),
    directusAdmin('GET', `/items/votes_citoyens?filter[utilisateur][_eq]=${uid}&aggregate[count]=id`),
  ])
  return new Response(JSON.stringify({
    pseudo: u.data?.pseudo,
    email: u.data?.email,
    commentaires: comm.data?.[0]?.count?.id || 0,
    votes: votes.data?.[0]?.count?.id || 0,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

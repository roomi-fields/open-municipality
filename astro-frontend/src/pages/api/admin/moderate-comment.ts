import type { APIRoute } from 'astro'
import { getSessionCookie, isModerator, directusAdmin } from '../../../lib/auth'

export const POST: APIRoute = async ({ request, cookies }) => {
  const me = getSessionCookie(cookies)
  if (!isModerator(me)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })

  const { id, action } = await request.json()
  if (!id) return new Response(JSON.stringify({ error: 'missing id' }), { status: 400 })

  if (action === 'delete') {
    // Supprime aussi les votes pouce associés
    await directusAdmin('GET', `/items/commentaire_votes?filter[commentaire][_eq]=${id}&limit=500&fields=id`).then(async (r) => {
      for (const v of r.data || []) await directusAdmin('DELETE', `/items/commentaire_votes/${v.id}`)
    })
    await directusAdmin('DELETE', `/items/commentaires/${id}`)
  } else if (action === 'moderate') {
    await directusAdmin('PATCH', `/items/commentaires/${id}`, { modere: true })
  } else if (action === 'restore') {
    await directusAdmin('PATCH', `/items/commentaires/${id}`, { modere: false })
  } else {
    return new Response(JSON.stringify({ error: 'invalid action' }), { status: 400 })
  }

  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}

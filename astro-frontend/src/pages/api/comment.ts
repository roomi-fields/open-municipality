import type { APIRoute } from 'astro'
import { getSessionCookie, directusAdmin } from '../../lib/auth'

const TYPES = ['argument_pour', 'argument_contre', 'question', 'proposition_alternative']

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = getSessionCookie(cookies)
  if (!user) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })

  let body: any
  try { body = await request.json() } catch { return new Response(JSON.stringify({ error: 'bad json' }), { status: 400 }) }

  const delibId = Number(body.deliberation)
  const type = String(body.type || '')
  const contenu = String(body.contenu || '').trim()

  if (!delibId || !TYPES.includes(type) || contenu.length < 5) {
    return new Response(JSON.stringify({ error: 'Champs invalides (5 caractères min)' }), { status: 400 })
  }
  if (contenu.length > 2000) {
    return new Response(JSON.stringify({ error: 'Commentaire trop long (max 2000 caractères)' }), { status: 400 })
  }

  await directusAdmin('POST', '/items/commentaires', {
    auteur: user.sub,
    deliberation: delibId,
    type,
    contenu,
    modere: false,
  })
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

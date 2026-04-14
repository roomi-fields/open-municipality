import type { APIRoute } from 'astro'
import { getSessionCookie, isAdmin, directusAdmin } from '../../../lib/auth'

const ROLES = ['citoyen', 'moderateur', 'admin']

export const POST: APIRoute = async ({ request, cookies }) => {
  const me = getSessionCookie(cookies)
  if (!isAdmin(me)) return new Response(JSON.stringify({ error: 'forbidden' }), { status: 403 })

  const { uid, role } = await request.json()
  if (!uid || !ROLES.includes(role)) return new Response(JSON.stringify({ error: 'bad params' }), { status: 400 })
  if (uid === me!.sub && role !== 'admin') {
    return new Response(JSON.stringify({ error: 'Vous ne pouvez pas vous retirer votre rôle admin' }), { status: 400 })
  }

  await directusAdmin('PATCH', `/items/citoyens/${uid}`, { role })
  return new Response(JSON.stringify({ ok: true }), { status: 200 })
}

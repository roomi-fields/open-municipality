import type { APIRoute } from 'astro'
import { getSessionCookie, directusAdmin } from '../../../lib/auth'

export const POST: APIRoute = async ({ request, cookies }) => {
  const user = getSessionCookie(cookies)
  if (!user) return new Response(JSON.stringify({ error: 'unauthenticated' }), { status: 401 })

  const body = await request.json()
  const patch: any = {}
  if (typeof body.notif_cm === 'boolean') patch.notif_cm = body.notif_cm

  if (!Object.keys(patch).length) return new Response(JSON.stringify({ error: 'empty' }), { status: 400 })

  await directusAdmin('PATCH', `/items/citoyens/${user.sub}`, patch)
  return new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

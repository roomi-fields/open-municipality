import type { APIRoute } from 'astro'
import { getSessionCookie } from '../../lib/auth'

export const GET: APIRoute = async ({ cookies }) => {
  const user = getSessionCookie(cookies)
  return new Response(JSON.stringify({ user }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

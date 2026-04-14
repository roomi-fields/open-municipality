import type { APIRoute } from 'astro'
import { clearSessionCookie } from '../../../lib/auth'

export const POST: APIRoute = async ({ cookies, redirect }) => {
  clearSessionCookie(cookies)
  return redirect('/')
}

export const GET: APIRoute = async ({ cookies, redirect }) => {
  clearSessionCookie(cookies)
  return redirect('/')
}

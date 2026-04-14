/**
 * Helpers auth côté serveur (Astro).
 * - getAdminToken : obtient et cache un token admin Directus via login()
 * - directusAdmin : effectue une requête API Directus avec le token admin
 * - signSession / verifySession : JWT pour la session utilisateur (cookie httpOnly)
 * - getUserFromRequest : extrait le citoyen connecté depuis le cookie
 */
import jwt from 'jsonwebtoken'
import crypto from 'crypto'

const DIRECTUS_URL = process.env.DIRECTUS_URL || import.meta.env.DIRECTUS_URL || 'http://localhost:8055'
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || import.meta.env.ADMIN_EMAIL || 'admin@plateforme-citoyenne.fr'
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || import.meta.env.ADMIN_PASSWORD || 'admin'
const JWT_SECRET = process.env.JWT_SECRET || import.meta.env.JWT_SECRET || process.env.DIRECTUS_SECRET || 'dev-secret'
const SESSION_COOKIE = 'pcl_session'
const SESSION_TTL_DAYS = 30
const MAGIC_TTL_MIN = 15

let cachedToken = ''
let cachedExpiry = 0

export async function getAdminToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < cachedExpiry) return cachedToken
  const resp = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
  })
  const data = await resp.json()
  if (!data.data?.access_token) throw new Error('Directus admin login failed')
  cachedToken = data.data.access_token
  cachedExpiry = now + 10 * 60_000 // 10 min
  return cachedToken
}

export async function directusAdmin(method: string, endpoint: string, body?: any): Promise<any> {
  const token = await getAdminToken()
  const resp = await fetch(`${DIRECTUS_URL}${endpoint}`, {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (resp.status === 204) return {}
  const text = await resp.text()
  try { return JSON.parse(text) } catch { return text }
}

export interface SessionPayload {
  sub: string // citoyen uuid
  email: string
  pseudo: string
  role?: 'citoyen' | 'moderateur' | 'admin'
}

export function isModerator(s: SessionPayload | null): boolean {
  return !!s && (s.role === 'moderateur' || s.role === 'admin')
}
export function isAdmin(s: SessionPayload | null): boolean {
  return !!s && s.role === 'admin'
}

export function signSession(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: `${SESSION_TTL_DAYS}d` })
}

export function verifySession(token: string): SessionPayload | null {
  try { return jwt.verify(token, JWT_SECRET) as SessionPayload } catch { return null }
}

export function getSessionCookie(cookies: any): SessionPayload | null {
  const token = cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  return verifySession(token)
}

export function setSessionCookie(cookies: any, payload: SessionPayload) {
  const token = signSession(payload)
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    secure: import.meta.env.PROD,
    sameSite: 'lax',
    maxAge: SESSION_TTL_DAYS * 24 * 3600,
  })
}

export function clearSessionCookie(cookies: any) {
  cookies.delete(SESSION_COOKIE, { path: '/' })
}

export function generateMagicToken(): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + MAGIC_TTL_MIN * 60_000)
  return { token, expiresAt }
}

export { SESSION_COOKIE, MAGIC_TTL_MIN }

/**
 * Client Directus partagé par tous les scripts.
 */

export const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
// Jeton statique Directus : compte de service à droits limités pour les tâches
// automatiques, jeton d'un humain administrateur pour les scripts de mise en place.
const TOKEN = process.env.DIRECTUS_TOKEN || ''
if (!TOKEN) throw new Error('DIRECTUS_TOKEN manquant')

// Force new connection on each request (avoid Node.js undici socket reuse issues)
const fetchOpts = { keepalive: false }

export async function api(method: string, endpoint: string, body?: any): Promise<any> {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}`, 'Connection': 'close' },
    ...fetchOpts,
  }
  if (body) opts.body = JSON.stringify(body)
  const resp = await fetch(`${DIRECTUS_URL}${endpoint}`, opts)
  // Une requête refusée doit échouer : renvoyer une liste vide ferait créer des doublons
  if (!resp.ok) throw new Error(`Directus ${method} ${endpoint} → ${resp.status} ${await resp.text()}`)
  return resp.status === 204 ? {} : resp.json()
}

export async function getItems(collection: string, filter?: string): Promise<any[]> {
  const qs = filter ? `?${filter}` : ''
  const data = await api('GET', `/items/${collection}${qs}`)
  return data.data || []
}

export async function getItem(collection: string, id: number | string): Promise<any | null> {
  const data = await api('GET', `/items/${collection}/${id}`)
  return data.data || null
}

export async function createItem(collection: string, item: any): Promise<any> {
  const data = await api('POST', `/items/${collection}`, item)
  return data.data
}

export async function updateItem(collection: string, id: number | string, item: any): Promise<any> {
  const data = await api('PATCH', `/items/${collection}/${id}`, item)
  return data.data
}

export async function upsert(collection: string, filter: string, data: any): Promise<number> {
  const existing = await getItems(collection, `filter${filter}&limit=1`)
  if (existing.length > 0) return existing[0].id
  const created = await createItem(collection, data)
  return created?.id
}

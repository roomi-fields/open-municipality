// Server-side : process.env (runtime, prod-safe). Browser : import.meta.env.PUBLIC_*.
// Pour les composants React qui tournent côté client, utiliser PUBLIC_DIRECTUS_URL.
const DIRECTUS_URL =
  (typeof process !== 'undefined' && process.env?.DIRECTUS_URL) ||
  import.meta.env.PUBLIC_DIRECTUS_URL ||
  'http://localhost:8055'

function buildQuery(params?: Record<string, string>): string {
  if (!params) return ''
  const parts = Object.entries(params).map(([k, v]) => `${encodeURI(k)}=${encodeURIComponent(v)}`)
  return '?' + parts.join('&')
}

export async function fetchItems(collection: string, params?: Record<string, string>): Promise<any[]> {
  const url = `${DIRECTUS_URL}/items/${collection}${buildQuery(params)}`
  try {
    const resp = await fetch(url)
    if (!resp.ok) return []
    const data = await resp.json()
    return data.data || []
  } catch {
    return []
  }
}

export async function fetchItem(collection: string, id: string | number, params?: Record<string, string>): Promise<any | null> {
  const url = `${DIRECTUS_URL}/items/${collection}/${id}${buildQuery(params)}`
  try {
    const resp = await fetch(url)
    if (!resp.ok) return null
    const data = await resp.json()
    return data.data || null
  } catch {
    return null
  }
}

export async function getSeanceIds(collectiviteId: string): Promise<number[]> {
  const seances = await fetchItems('seances', {
    'filter[collectivite][_eq]': collectiviteId,
    'fields': 'id',
    'limit': '200',
  })
  return seances.map((s: any) => s.id)
}

export { DIRECTUS_URL }

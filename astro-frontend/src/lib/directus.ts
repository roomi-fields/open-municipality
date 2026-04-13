const DIRECTUS_URL = import.meta.env.DIRECTUS_URL || 'http://localhost:8055'

function buildQuery(params?: Record<string, string>): string {
  if (!params) return ''
  // Directus utilise des brackets dans les query params (filter[field][_eq]=value)
  // URLSearchParams les encode mal, on construit la query string manuellement
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

/** Récupère les IDs de séances pour une collectivité donnée */
export async function getSeanceIds(collectiviteId: string): Promise<number[]> {
  const seances = await fetchItems('seances', {
    'filter[collectivite][_eq]': collectiviteId,
    'fields': 'id',
    'limit': '200',
  })
  return seances.map((s: any) => s.id)
}

export { DIRECTUS_URL }

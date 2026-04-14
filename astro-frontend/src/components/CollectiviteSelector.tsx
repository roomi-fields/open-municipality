import { useEffect, useState } from 'react'

// PUBLIC_DIRECTUS_URL est exposé au navigateur (préfixe PUBLIC_ requis par Astro)
const DIRECTUS_URL = import.meta.env.PUBLIC_DIRECTUS_URL || 'http://localhost:8055'

interface Collectivite {
  id: number
  nom: string
  type: string
  parent_interco?: number | null
  parent_canton?: number | null
}

const TYPE_COLORS: Record<string, { active: string; inactive: string }> = {
  commune: { active: 'bg-green-800 text-white', inactive: 'bg-green-50 text-green-800 hover:bg-green-100' },
  interco: { active: 'bg-blue-700 text-white', inactive: 'bg-blue-50 text-blue-800 hover:bg-blue-100' },
  canton: { active: 'bg-purple-700 text-white', inactive: 'bg-purple-50 text-purple-800 hover:bg-purple-100' },
}

// Pages où le filtre ne s'affiche pas
const PAGES_SANS_FILTRE = ['/signalements', '/petitions', '/connexion', '/newsletter', '/blog']

// V1 : une seule commune cible (L'Isle-Jourdain)
const COMMUNE_V1 = '1'

export default function CollectiviteSelector() {
  const [collectivites, setCollectivites] = useState<Collectivite[]>([])
  const [maCommune, setMaCommune] = useState(COMMUNE_V1)
  const [selected, setSelected] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'

  useEffect(() => {
    fetch(`${DIRECTUS_URL}/items/collectivites?limit=200`)
      .then(r => r.json())
      .then(data => { if (data.data) setCollectivites(data.data) })
      .catch(() => {})

    const params = new URLSearchParams(window.location.search)
    setSelected(params.get('collectivite') || '')
  }, [])

  // V1 : pas d'auto-application du filtre au chargement (on montre tout par défaut)

  const shouldHide = PAGES_SANS_FILTRE.some(p => pathname.startsWith(p))
  if (shouldHide) return null
  if (collectivites.length === 0) return null

  const communes = collectivites.filter(c => c.type === 'commune').sort((a, b) => a.nom.localeCompare(b.nom))
  const communeObj = maCommune ? collectivites.find(c => String(c.id) === maCommune) : null
  const monInterco = communeObj ? collectivites.find(c => c.type === 'interco') : null
  const monCanton = communeObj ? collectivites.find(c => c.type === 'canton') : null

  function navigate(id: string) {
    const params = new URLSearchParams(window.location.search)
    if (id) {
      params.set('collectivite', id)
    } else {
      params.delete('collectivite')
    }
    const qs = params.toString()
    setSelected(id)
    window.history.replaceState({}, '', pathname + (qs ? `?${qs}` : ''))
    // Recharger la page pour que le SSR prenne en compte le filtre
    window.location.reload()
  }

  function handleCommuneChange(id: string) {
    setMaCommune(id)
    localStorage.setItem('maCommune', id)
    setShowPicker(false)
    navigate(id)
  }

  return (
    <div className="mx-auto max-w-6xl px-4">
      <div className="flex items-center gap-2 border-b border-gray-100 py-2 flex-wrap">
        <span className="text-xs text-gray-400 mr-1">Filtrer par :</span>
        <button
          onClick={() => navigate('')}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            !selected ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Tout
        </button>
        <button
          onClick={() => navigate(String(communeObj?.id || COMMUNE_V1))}
          className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
            selected === String(communeObj?.id) ? TYPE_COLORS.commune.active : TYPE_COLORS.commune.inactive
          }`}
        >
          {communeObj?.nom || 'Commune'}
        </button>
        {monInterco && (
          <button
            onClick={() => navigate(String(monInterco.id))}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              selected === String(monInterco.id) ? TYPE_COLORS.interco.active : TYPE_COLORS.interco.inactive
            }`}
          >
            {monInterco.nom}
          </button>
        )}
        {monCanton && (
          <button
            onClick={() => navigate(String(monCanton.id))}
            className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
              selected === String(monCanton.id) ? TYPE_COLORS.canton.active : TYPE_COLORS.canton.inactive
            }`}
          >
            {monCanton.nom}
          </button>
        )}
      </div>
    </div>
  )
}

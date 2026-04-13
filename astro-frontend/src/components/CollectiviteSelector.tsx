import { useEffect, useState } from 'react'

const DIRECTUS_URL = 'http://localhost:8055'

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
const PAGES_SANS_FILTRE = ['/signalements', '/petitions', '/connexion', '/newsletter']

export default function CollectiviteSelector() {
  const [collectivites, setCollectivites] = useState<Collectivite[]>([])
  const [maCommune, setMaCommune] = useState('')
  const [selected, setSelected] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/'

  useEffect(() => {
    fetch(`${DIRECTUS_URL}/items/collectivites?limit=200`)
      .then(r => r.json())
      .then(data => { if (data.data) setCollectivites(data.data) })
      .catch(() => {})

    const saved = localStorage.getItem('maCommune')
    if (saved) setMaCommune(saved)

    const params = new URLSearchParams(window.location.search)
    setSelected(params.get('collectivite') || '')
  }, [])

  // Appliquer le filtre sauvegardé au premier chargement
  useEffect(() => {
    if (maCommune && !selected && collectivites.length > 0) {
      navigate(maCommune)
    }
  }, [maCommune, collectivites.length])

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
        {!maCommune ? (
          <select
            onChange={e => handleCommuneChange(e.target.value)}
            value=""
            className="rounded-full border border-gray-300 px-3 py-1 text-sm font-medium bg-white focus:outline-none focus:ring-1 focus:ring-green-500"
          >
            <option value="">Choisir ma commune...</option>
            {communes.map(c => (
              <option key={c.id} value={c.id}>{c.nom}</option>
            ))}
          </select>
        ) : (
          <>
            <button
              onClick={() => navigate(String(communeObj?.id || ''))}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                selected === String(communeObj?.id) ? TYPE_COLORS.commune.active : TYPE_COLORS.commune.inactive
              }`}
            >
              {communeObj?.nom || 'Ma commune'}
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

            <button
              onClick={() => navigate('')}
              className={`rounded-full px-3 py-1 text-sm font-medium transition-colors ${
                !selected ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Tout
            </button>

            <div className="relative ml-auto">
              <button
                onClick={() => setShowPicker(!showPicker)}
                className="text-xs text-gray-400 hover:text-gray-600"
              >
                Changer de commune
              </button>
              {showPicker && (
                <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50">
                  {communes.map(c => (
                    <button
                      key={c.id}
                      onClick={() => handleCommuneChange(String(c.id))}
                      className={`block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50 ${
                        String(c.id) === maCommune ? 'font-semibold text-green-700' : ''
                      }`}
                    >
                      {c.nom}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

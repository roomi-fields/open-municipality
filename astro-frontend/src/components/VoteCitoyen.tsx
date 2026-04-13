import { useState, useEffect } from 'react'

const DIRECTUS_URL = 'http://localhost:8055'

interface Props {
  deliberationId: number
}

export default function VoteCitoyen({ deliberationId }: Props) {
  const [counts, setCounts] = useState({ pour: 0, contre: 0, abstention: 0 })
  const [voted, setVoted] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`${DIRECTUS_URL}/items/votes_citoyens?filter[deliberation][_eq]=${deliberationId}&aggregate[count]=choix&groupBy[]=choix`)
      .then(r => r.json())
      .then(data => {
        const c = { pour: 0, contre: 0, abstention: 0 }
        for (const row of data.data || []) {
          if (row.choix in c) c[row.choix as keyof typeof c] = parseInt(row.count?.choix || '0')
        }
        setCounts(c)
      })
      .catch(() => {})
  }, [deliberationId, voted])

  async function vote(choix: string) {
    setLoading(true)
    // TODO: auth token from cookie
    const token = localStorage.getItem('directus_token')
    if (!token) {
      alert('Connectez-vous pour voter')
      setLoading(false)
      return
    }
    await fetch(`${DIRECTUS_URL}/items/votes_citoyens`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ deliberation: deliberationId, choix }),
    })
    setVoted(true)
    setLoading(false)
  }

  const total = counts.pour + counts.contre + counts.abstention

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mt-6">
      <h3 className="text-sm font-semibold text-blue-800 mb-3">Vote citoyen</h3>
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => vote('pour')}
          disabled={loading || voted}
          className="flex-1 rounded-lg bg-green-600 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          Pour
        </button>
        <button
          onClick={() => vote('contre')}
          disabled={loading || voted}
          className="flex-1 rounded-lg bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
        >
          Contre
        </button>
        <button
          onClick={() => vote('abstention')}
          disabled={loading || voted}
          className="flex-1 rounded-lg bg-gray-400 py-2 text-sm font-semibold text-white hover:bg-gray-500 disabled:opacity-50"
        >
          Abstention
        </button>
      </div>
      {total > 0 && (
        <div>
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-gray-200">
            <div className="bg-green-500" style={{ width: `${(counts.pour / total) * 100}%` }} />
            <div className="bg-red-500" style={{ width: `${(counts.contre / total) * 100}%` }} />
            <div className="bg-gray-400" style={{ width: `${(counts.abstention / total) * 100}%` }} />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-600">
            <span>{counts.pour} pour</span>
            <span>{counts.contre} contre</span>
            <span>{counts.abstention} abstention</span>
          </div>
        </div>
      )}
      {voted && <p className="text-xs text-green-700 mt-2">Vote enregistre !</p>}
    </div>
  )
}

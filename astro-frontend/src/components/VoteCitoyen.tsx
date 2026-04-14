import { useState, useEffect } from 'react'

interface Props { deliberationId: number }

type Choix = 'pour' | 'contre' | 'abstention'

export default function VoteCitoyen({ deliberationId }: Props) {
  const [counts, setCounts] = useState({ pour: 0, contre: 0, abstention: 0 })
  const [myVote, setMyVote] = useState<Choix | null>(null)
  const [authed, setAuthed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [msg, setMsg] = useState('')

  function refresh() {
    fetch(`/api/vote?deliberation=${deliberationId}`)
      .then(r => r.json())
      .then(d => {
        if (d.counts) setCounts(d.counts)
        setMyVote(d.myVote || null)
        setAuthed(!!d.authenticated)
      }).catch(() => {})
  }
  useEffect(() => { refresh() }, [deliberationId])

  async function vote(choix: Choix) {
    if (!authed) {
      window.location.href = `/connexion?next=${encodeURIComponent(window.location.pathname)}`
      return
    }
    setLoading(true); setMsg('')
    const resp = await fetch('/api/vote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deliberation: deliberationId, choix }),
    })
    setLoading(false)
    if (!resp.ok) { setMsg('Erreur'); return }
    const d = await resp.json()
    setMsg(d.updated ? 'Vote modifié ✓' : 'Vote enregistré ✓')
    refresh()
    setTimeout(() => setMsg(''), 3000)
  }

  const total = counts.pour + counts.contre + counts.abstention

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 mt-6">
      <h3 className="text-sm font-semibold text-blue-800 mb-3">Vote citoyen</h3>
      {!authed && (
        <p className="text-xs text-blue-700 mb-3">
          <a href={`/connexion?next=${typeof window !== 'undefined' ? encodeURIComponent(window.location.pathname) : ''}`} className="font-semibold underline">Connectez-vous</a> pour voter. Vous pourrez modifier votre vote à tout moment.
        </p>
      )}
      <div className="flex gap-2 mb-3">
        <button
          onClick={() => vote('pour')}
          disabled={loading}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 ${myVote === 'pour' ? 'bg-green-700 ring-2 ring-green-900' : 'bg-green-600 hover:bg-green-700'}`}
        >
          Pour {myVote === 'pour' && '✓'}
        </button>
        <button
          onClick={() => vote('contre')}
          disabled={loading}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 ${myVote === 'contre' ? 'bg-red-700 ring-2 ring-red-900' : 'bg-red-600 hover:bg-red-700'}`}
        >
          Contre {myVote === 'contre' && '✓'}
        </button>
        <button
          onClick={() => vote('abstention')}
          disabled={loading}
          className={`flex-1 rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-50 ${myVote === 'abstention' ? 'bg-gray-600 ring-2 ring-gray-800' : 'bg-gray-400 hover:bg-gray-500'}`}
        >
          Abstention {myVote === 'abstention' && '✓'}
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
      {msg && <p className="text-xs text-green-700 mt-2">{msg}</p>}
    </div>
  )
}

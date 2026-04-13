import { useState } from 'react'

const DIRECTUS_URL = 'http://localhost:8055'

interface Props {
  petitionId: number
  currentSignatures: number
  seuil: number
}

export default function SignerPetition({ petitionId, currentSignatures, seuil }: Props) {
  const [signatures, setSignatures] = useState(currentSignatures)
  const [signed, setSigned] = useState(false)
  const [loading, setLoading] = useState(false)

  async function signer() {
    setLoading(true)
    const token = localStorage.getItem('directus_token')
    if (!token) {
      alert('Connectez-vous pour signer')
      setLoading(false)
      return
    }

    // Ajouter la signature dans la table de jonction
    await fetch(`${DIRECTUS_URL}/items/petitions_signatures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ petition: petitionId }),
    })

    // Mettre à jour le compteur
    await fetch(`${DIRECTUS_URL}/items/petitions/${petitionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ nombre_signatures: signatures + 1 }),
    })

    setSignatures(s => s + 1)
    setSigned(true)
    setLoading(false)
  }

  const pct = Math.min(100, (signatures / seuil) * 100)

  return (
    <div className="mt-3">
      <div className="h-3 w-full rounded-full bg-gray-100">
        <div className="h-3 rounded-full bg-blue-600 transition-all" style={{ width: `${pct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm text-gray-600">{signatures} / {seuil} signatures</span>
        {!signed ? (
          <button
            onClick={signer}
            disabled={loading}
            className="rounded-lg bg-blue-700 px-4 py-1.5 text-sm font-semibold text-white hover:bg-blue-800 disabled:opacity-50"
          >
            {loading ? '...' : 'Signer'}
          </button>
        ) : (
          <span className="text-sm text-green-600 font-medium">Signe !</span>
        )}
      </div>
    </div>
  )
}

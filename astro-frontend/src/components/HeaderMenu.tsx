import { useState, useEffect } from 'react'

interface MeResponse { user: { sub: string; email: string; pseudo: string } | null }

export default function HeaderMenu() {
  const [user, setUser] = useState<MeResponse['user']>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/me')
      .then(r => r.ok ? r.json() : { user: null })
      .then((d: MeResponse) => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoaded(true))
  }, [])

  if (!loaded) return null

  if (!user) {
    return (
      <a href="/connexion" className="rounded-lg bg-green-800 px-4 py-2 text-white hover:bg-green-700 text-sm">
        Connexion
      </a>
    )
  }

  return (
    <div className="relative">
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1.5 text-green-800 hover:bg-green-100 text-sm"
      >
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-green-700 text-xs text-white font-bold">
          {user.pseudo[0].toUpperCase()}
        </span>
        {user.pseudo}
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50">
          <a href="/mon-espace" className="block px-3 py-2 text-sm hover:bg-gray-50">Mon espace</a>
          <form action="/api/auth/logout" method="POST" className="border-t border-gray-100">
            <button type="submit" className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">
              Se déconnecter
            </button>
          </form>
        </div>
      )}
    </div>
  )
}

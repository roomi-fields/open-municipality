import { useState, useEffect } from 'react'

const DIRECTUS_URL = 'http://localhost:8055'

export default function HeaderMenu() {
  const [user, setUser] = useState<any>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const token = localStorage.getItem('directus_token')
    if (!token) return
    fetch(`${DIRECTUS_URL}/users/me`, {
      headers: { 'Authorization': `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.data) setUser(data.data) })
      .catch(() => {})
  }, [])

  async function handleLogout() {
    const token = localStorage.getItem('directus_token')
    if (token) {
      await fetch(`${DIRECTUS_URL}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: localStorage.getItem('directus_refresh') }),
      }).catch(() => {})
    }
    localStorage.removeItem('directus_token')
    localStorage.removeItem('directus_refresh')
    setUser(null)
    window.location.href = '/'
  }

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
          {(user.pseudo || user.email || '?')[0].toUpperCase()}
        </span>
        {user.pseudo || user.email}
      </button>
      {menuOpen && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-gray-200 bg-white py-1 shadow-lg z-50">
          <div className="px-3 py-2 text-xs text-gray-400 border-b border-gray-100">
            {user.role_citoyen === 'admin' ? 'Administrateur' : 'Citoyen'}
          </div>
          {user.role_citoyen === 'admin' && (
            <a href="http://localhost:8055/admin" className="block px-3 py-2 text-sm hover:bg-gray-50">
              Administration
            </a>
          )}
          <a href="/newsletter" className="block px-3 py-2 text-sm hover:bg-gray-50">Newsletter</a>
          <button
            onClick={handleLogout}
            className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Se deconnecter
          </button>
        </div>
      )}
    </div>
  )
}

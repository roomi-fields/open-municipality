import type { APIRoute } from 'astro'
import { directusAdmin, setSessionCookie } from '../../../lib/auth'

export const GET: APIRoute = async ({ request, cookies, redirect }) => {
  const token = new URL(request.url).searchParams.get('token')
  if (!token) return redirect('/connexion?error=missing_token')

  // Trouver le token
  const r = await directusAdmin('GET', `/items/magic_tokens?filter[token][_eq]=${encodeURIComponent(token)}&limit=1`)
  const mt = r.data?.[0]
  if (!mt) return redirect('/connexion?error=invalid')
  if (mt.used) return redirect('/connexion?error=used')
  if (new Date(mt.expires_at) < new Date()) return redirect('/connexion?error=expired')

  // Marquer token utilisé
  await directusAdmin('PATCH', `/items/magic_tokens/${mt.id}`, { used: true })

  // Trouver / créer le citoyen
  let citoyen: any
  if (mt.citoyen) {
    const r2 = await directusAdmin('GET', `/items/citoyens/${mt.citoyen}`)
    citoyen = r2.data
  } else {
    // Nouvelle inscription : le citoyen n'existe pas encore
    const r2 = await directusAdmin('POST', '/items/citoyens', {
      email: mt.email,
      pseudo: mt.pseudo,
      prenom: mt.prenom || null,
      confirmed: true,
      rgpd_accepte: true,
    })
    citoyen = r2.data
  }

  if (!citoyen) return redirect('/connexion?error=unknown')

  // S'il n'était pas confirmed, on le passe confirmed maintenant
  if (!citoyen.confirmed) {
    await directusAdmin('PATCH', `/items/citoyens/${citoyen.id}`, { confirmed: true })
  }

  // Créer session cookie
  setSessionCookie(cookies, {
    sub: citoyen.id,
    email: citoyen.email,
    pseudo: citoyen.pseudo,
    role: citoyen.role || 'citoyen',
  })

  return redirect('/mon-espace?welcome=1')
}

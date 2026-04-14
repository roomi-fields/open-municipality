import type { APIRoute } from 'astro'
import { directusAdmin, generateMagicToken, MAGIC_TTL_MIN } from '../../../lib/auth'
import { sendMail, magicLinkEmail } from '../../../lib/email'

export const POST: APIRoute = async ({ request, url }) => {
  let body: any
  try { body = await request.json() } catch { return new Response(JSON.stringify({ error: 'invalid JSON' }), { status: 400 }) }

  const email = String(body.email || '').trim().toLowerCase()
  const pseudo = String(body.pseudo || '').trim()
  const prenom = String(body.prenom || '').trim()
  const rgpd = Boolean(body.rgpd_accepte)

  if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return new Response(JSON.stringify({ error: 'Email invalide' }), { status: 400 })
  }

  // Chercher citoyen existant
  const existing = await directusAdmin('GET', `/items/citoyens?filter[email][_eq]=${encodeURIComponent(email)}&limit=1`)
  const citoyen = existing.data?.[0]

  // Si nouvelle inscription : pseudo obligatoire + rgpd accepté
  if (!citoyen) {
    if (!pseudo || pseudo.length < 2) {
      return new Response(JSON.stringify({ error: 'Pseudo requis (min 2 caractères)' }), { status: 400 })
    }
    if (!rgpd) {
      return new Response(JSON.stringify({ error: 'Vous devez accepter les conditions RGPD' }), { status: 400 })
    }
    // Vérifier unicité du pseudo
    const pseudoCheck = await directusAdmin('GET', `/items/citoyens?filter[pseudo][_eq]=${encodeURIComponent(pseudo)}&limit=1`)
    if (pseudoCheck.data?.length) {
      return new Response(JSON.stringify({ error: 'Ce pseudo est déjà utilisé' }), { status: 409 })
    }
  }

  // Générer magic token
  const { token, expiresAt } = generateMagicToken()
  await directusAdmin('POST', '/items/magic_tokens', {
    token,
    email,
    pseudo: citoyen ? null : pseudo,
    prenom: citoyen ? null : prenom,
    citoyen: citoyen?.id || null,
    expires_at: expiresAt.toISOString(),
    used: false,
  })

  // Construire le lien
  const origin = new URL(request.url).origin
  const link = `${origin}/api/auth/verify?token=${token}`

  const { subject, html } = magicLinkEmail(link, citoyen?.pseudo || pseudo)
  const sent = await sendMail(email, subject, html)

  // En dev, log le lien pour pouvoir se connecter sans dépendre de la délivrabilité email
  const isDev = import.meta.env.DEV
  if (isDev) console.log(`\n🔑 MAGIC LINK for ${email}: ${link}\n`)

  return new Response(JSON.stringify({
    ok: true,
    message: `Un lien de connexion vient d'être envoyé à ${email}. Valable ${MAGIC_TTL_MIN} minutes. (Pensez à vérifier vos spams.)`,
    devLink: isDev ? link : undefined,
  }), { status: 200, headers: { 'Content-Type': 'application/json' } })
}

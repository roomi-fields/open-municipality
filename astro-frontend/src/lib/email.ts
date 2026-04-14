/**
 * Envoi d'emails via Brevo (transactional API).
 */
const BREVO_API_KEY = import.meta.env.BREVO_API_KEY
const EMAIL_FROM_NAME = 'Plateforme Citoyenne Lisloise'
const EMAIL_FROM = import.meta.env.EMAIL_FROM_ADDR || 'notifications@plateformecitoyennelisloise.fr'

export async function sendMail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  console.log(`[mail] to=${to} key=${BREVO_API_KEY ? 'set('+BREVO_API_KEY.substring(0,8)+'...)' : 'MISSING'} from=${EMAIL_FROM}`)
  if (!BREVO_API_KEY) {
    console.log('[mail] BREVO_API_KEY missing — simulated send to', to)
    console.log('       subject:', subject)
    return true
  }
  const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'api-key': BREVO_API_KEY },
    body: JSON.stringify({
      sender: { name: EMAIL_FROM_NAME, email: EMAIL_FROM },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text || html.replace(/<[^>]+>/g, ''),
    }),
  })
  const respText = await resp.text()
  if (!resp.ok) {
    console.error('[mail] Brevo error', resp.status, respText)
    return false
  }
  console.log('[mail] Brevo OK', resp.status, respText)
  return true
}

export function magicLinkEmail(link: string, pseudo?: string): { subject: string; html: string } {
  const greet = pseudo ? `Bonjour ${pseudo},` : 'Bonjour,'
  return {
    subject: 'Votre lien de connexion — Plateforme Citoyenne Lisloise',
    html: `
<div style="font-family: system-ui, sans-serif; max-width: 560px; margin: auto; padding: 24px;">
  <h1 style="color: #15803d; font-size: 22px;">Plateforme Citoyenne Lisloise</h1>
  <p>${greet}</p>
  <p>Cliquez sur ce bouton pour vous connecter :</p>
  <p style="margin: 24px 0;">
    <a href="${link}" style="background: #15803d; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">Me connecter</a>
  </p>
  <p style="font-size: 13px; color: #666;">Ce lien est valable <strong>15 minutes</strong>. Si vous n'avez pas demandé cette connexion, ignorez ce message.</p>
  <p style="font-size: 12px; color: #999; margin-top: 32px;">Lien direct si le bouton ne fonctionne pas : <br/><a href="${link}" style="color: #666;">${link}</a></p>
</div>`,
  }
}

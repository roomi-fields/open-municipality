/**
 * Service d'envoi d'email via Brevo (ex-Sendinblue).
 * API REST — pas de SDK nécessaire.
 */

const BREVO_URL = 'https://api.brevo.com/v3/smtp/email'
const DEFAULT_FROM = { name: 'Plateforme Citoyenne', email: 'notifications@plateforme-citoyenne.fr' }

export async function sendEmail(to: string, subject: string, html: string): Promise<{ success: boolean; error?: string }> {
  const apiKey = process.env.BREVO_API_KEY
  if (!apiKey) return { success: false, error: 'BREVO_API_KEY manquante' }

  const fromEnv = process.env.EMAIL_FROM
  const sender = fromEnv
    ? { name: fromEnv.split('<')[0].trim(), email: fromEnv.match(/<(.+)>/)?.[1] || fromEnv }
    : DEFAULT_FROM

  try {
    const resp = await fetch(BREVO_URL, {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': apiKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        sender,
        to: [{ email: to }],
        subject,
        htmlContent: html,
      }),
    })

    if (!resp.ok) {
      const body = await resp.text()
      return { success: false, error: `Brevo ${resp.status}: ${body}` }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err.message }
  }
}

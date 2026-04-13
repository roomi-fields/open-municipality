/**
 * Notification des séances à venir — envoi email J-7 — Directus.
 * Usage : BREVO_API_KEY=xkeysib-... npx tsx notify-seances.ts
 */

import { login, getItems, createItem } from './lib/directus'
import { sendEmail } from './email'

const SITE_URL = process.env.SITE_URL || 'http://localhost:3333'

function formatDateFr(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}

function typeLabel(type: string): string {
  return type === 'conseil_municipal' ? 'Conseil Municipal' : 'Conseil Communautaire'
}

function buildEmailHtml(seance: any): string {
  const dateFr = formatDateFr(seance.date)
  const type = typeLabel(seance.type)
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="utf-8"></head>
<body style="font-family:-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;color:#333;">
  <div style="background:#1e40af;color:white;padding:20px;border-radius:8px 8px 0 0;">
    <h1 style="margin:0;font-size:20px;">Plateforme Citoyenne</h1>
  </div>
  <div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 8px 8px;">
    <h2 style="color:#1e40af;margin-top:0;">${type} à venir</h2>
    <div style="background:#f0f9ff;border-left:4px solid #1e40af;padding:16px;margin:16px 0;border-radius:0 4px 4px 0;">
      <p style="margin:0;font-size:18px;font-weight:bold;">${dateFr}</p>
      ${seance.lieu ? `<p style="margin:4px 0 0;color:#666;">${seance.lieu}</p>` : ''}
    </div>
    <a href="${SITE_URL}/deliberations" style="display:inline-block;background:#1e40af;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">Voir les délibérations</a>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
    <p style="font-size:12px;color:#999;">Pour vous désinscrire, modifiez vos préférences sur la plateforme.</p>
  </div>
</body></html>`
}

async function main() {
  if (!process.env.BREVO_API_KEY) {
    console.error('❌ BREVO_API_KEY manquante'); process.exit(1)
  }

  console.log('📧 Notification des séances à venir\n')
  await login()

  const seances = await getItems('seances', 'filter[statut][_eq]=a_venir&limit=20')
  if (!seances.length) { console.log('Aucune séance à venir'); return }

  const now = new Date()
  const minDate = new Date(now.getTime() + 5 * 86400000)
  const maxDate = new Date(now.getTime() + 8 * 86400000)

  const toNotify = seances.filter((s: any) => {
    const d = new Date(s.date)
    return d >= minDate && d <= maxDate
  })

  if (!toNotify.length) { console.log('Aucune séance dans la fenêtre J+5 à J+8'); return }

  for (const seance of toNotify) {
    console.log(`📅 ${typeLabel(seance.type)} — ${formatDateFr(seance.date)}`)

    const existingNotif = await getItems('notifications', `filter[seance][_eq]=${seance.id}&filter[type][_eq]=seance_a_venir&limit=1`)
    if (existingNotif.length > 0) { console.log('   ⏭ Déjà notifié'); continue }

    // Directus users with newsletter=true
    const users = await getItems('directus_users' as any, 'filter[newsletter][_eq]=true&limit=500')
    const subscribers = users.filter((u: any) => u.email && !u.email.includes('@citoyen.local'))

    if (!subscribers.length) { console.log('   ⚠️ Aucun abonné'); continue }

    const subject = `${typeLabel(seance.type)} le ${formatDateFr(seance.date)}`
    const html = buildEmailHtml(seance)
    let sent = 0, errors = 0

    for (const user of subscribers) {
      const result = await sendEmail(user.email, subject, html)
      result.success ? sent++ : errors++
      await new Promise(r => setTimeout(r, 100))
    }

    console.log(`   ✓ ${sent} envoyé(s), ${errors} erreur(s)`)
    await createItem('notifications', {
      type: 'seance_a_venir', seance: seance.id,
      sent_at: new Date().toISOString(), recipient_count: sent,
      status: errors > 0 ? 'error' : 'sent',
    })
  }
  console.log('\n✅ Notifications terminées')
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

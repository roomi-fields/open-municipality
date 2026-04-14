/**
 * Matérialise les items d'ordres du jour (seances.ordre_jour_items JSON)
 * en délibérations `a_venir` afin que les citoyens puissent voter dessus
 * avant la séance, et voir leur historique sur /mon-espace.
 *
 * Idempotent : retrouve les délibérations déjà créées via le numero pour
 * chaque (seance, oj.numero) et les met à jour plutôt que d'en créer en double.
 */
import { login, api, getItems, createItem, updateItem } from './lib/directus'

async function ensureStatutChoice() {
  // Ajouter "a_venir" aux choix possibles de deliberations.statut
  const f = await api('GET', '/fields/deliberations/statut')
  const choices = f.data?.meta?.options?.choices || []
  const hasAVenir = choices.some((c: any) => c.value === 'a_venir')
  if (!hasAVenir) {
    await api('PATCH', '/fields/deliberations/statut', {
      meta: {
        ...f.data.meta,
        options: {
          ...(f.data.meta.options || {}),
          choices: [
            ...choices,
            { text: 'À venir', value: 'a_venir' },
          ],
        },
      },
    })
    console.log('✅ Statut "a_venir" ajouté aux délibérations')
  }
}

interface OJItem { section: string; numero: number; titre: string }

async function main() {
  await login()
  await ensureStatutChoice()

  const seances = await getItems('seances',
    'filter[statut][_eq]=a_venir&limit=100&fields=id,date,type,ordre_jour_items')

  let created = 0, updated = 0
  for (const s of seances) {
    const oj: OJItem[] = Array.isArray(s.ordre_jour_items) ? s.ordre_jour_items
      : (s.ordre_jour_items ? JSON.parse(s.ordre_jour_items) : [])
    if (!oj.length) continue

    console.log(`\n📋 Séance ${s.id} (${s.date}) — ${oj.length} points`)

    for (const item of oj) {
      const numero = `OJ-${s.date}-${String(item.numero).padStart(3, '0')}`
      const existing = await getItems('deliberations',
        `filter[numero][_eq]=${encodeURIComponent(numero)}&limit=1&fields=id,statut`)
      const payload = {
        numero,
        titre: item.titre,
        resume_ia: `Point d'ordre du jour — Section : ${item.section}`,
        seance: s.id,
        statut: 'a_venir',
        vote_pour: 0,
        vote_contre: 0,
        vote_abstention: 0,
      }
      if (existing[0]) {
        // Ne pas écraser si déjà publié avec vrai vote
        if (existing[0].statut === 'publie') continue
        await updateItem('deliberations', existing[0].id, payload)
        updated++
      } else {
        await createItem('deliberations', payload)
        created++
      }
    }
  }

  console.log(`\n✅ ${created} créées, ${updated} mises à jour`)
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })

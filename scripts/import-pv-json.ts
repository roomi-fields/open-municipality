/**
 * Import un PV parsé (JSON) dans Directus.
 * Usage : npx tsx import-pv-json.ts ../data/pv-2025-12-16.json
 */

import fs from 'fs'
import { login, api, getItems, createItem, upsert } from './lib/directus'
import type { ParsedPV } from './parse-pv'

const THEME_RULES: Record<string, string[]> = {
  'finances': ['FINANCES', 'BUDGET', 'SUBVENTION', 'TAXE', 'IMPOT', 'EMPRUNT', 'PROVISIONS', 'NON VALEUR', 'CCAS'],
  'urbanisme': ['URBANISME', 'PLU', 'PERMIS', 'FONCIER', 'RAVALEMENT', 'VITRINE', 'REVITALISATION'],
  'education': ['SCOLAIRE', 'ECOLE', 'CANTINE', 'RESTAURATION', 'PERISCOLAIRE', 'DENREES'],
  'environnement': ['ENVIRONNEMENT', 'FORET', 'PEFC', 'DECHETS'],
  'eau': ['EAU', 'ASSAINISSEMENT', 'EPURATION', 'CAPTAGE'],
  'sport': ['SPORT', 'PISCINE', 'SOL SPORTIF', 'SPORTIF'],
  'culture': ['CULTURE', 'MEDIATHEQUE', 'ORPHEE'],
  'social': ['SOCIAL', 'API', 'CCAS', 'LOGEMENT', 'SOLIDARITE'],
  'tourisme': ['TOURISME', 'CAMPING', 'GITES', 'LAC', 'PECHE'],
  'funeraire': ['FUNERAIRE', 'FUNEBRES', 'CONCESSION', 'POMPES'],
  'transport': ['TRANSPORT', 'BUS', 'MOBILITE', 'VOIRIE', 'PONT', 'REFECTION'],
  'energie': ['PHOTOVOLTAIQUE', 'PANNEAUX'],
  'administration': ['COMPTE RENDU', 'DECISIONS PRISES', 'CONVENTION', 'DELEGATION', 'EMPLOI', 'EFFECTIF'],
}

function classifyTheme(titre: string): string {
  const upper = titre.toUpperCase()
  for (const [theme, keywords] of Object.entries(THEME_RULES)) {
    if (keywords.some(kw => upper.includes(kw))) return theme
  }
  return 'administration'
}

function normalizeForSearch(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ').trim()
}

export interface ImportPVOptions {
  seanceType?: 'conseil_municipal' | 'conseil_communautaire'
}

export async function importPV(pv: ParsedPV, options?: ImportPVOptions): Promise<void> {
  const seanceType = options?.seanceType || pv.seance?.type || 'conseil_municipal'

  console.log(`🏛  Import PV du ${pv.seance.date} — ${pv.deliberations.length} délibérations\n`)

  // Collectivité
  let collectiviteId: number
  if (seanceType === 'conseil_communautaire') {
    const items = await getItems('collectivites', 'filter[nom][_contains]=Gascogne&limit=1')
    collectiviteId = items[0]?.id
  } else {
    const items = await getItems('collectivites', 'filter[code_insee][_eq]=32160&limit=1')
    collectiviteId = items[0]?.id
  }
  if (!collectiviteId) throw new Error('Collectivité non trouvée')

  // Séance
  const seanceId = await upsert('seances', `[date][_eq]=${pv.seance.date}`, {
    date: pv.seance.date, type: seanceType, collectivite: collectiviteId,
    statut: 'passee', lieu: pv.seance?.lieu,
  })
  console.log(`📋 Séance: ${seanceId}`)

  // Élus
  console.log(`\n👥 Import des ${pv.conseillers.length} conseillers...`)
  async function findOrCreateElu(nom: string, prenom: string): Promise<number> {
    const items = await getItems('elus', `filter[nom][_eq]=${encodeURIComponent(nom)}&filter[prenom][_eq]=${encodeURIComponent(prenom)}&limit=1`)
    if (items.length > 0) return items[0].id

    // Recherche normalisée
    const allElus = await getItems('elus', 'limit=200')
    const normNom = normalizeForSearch(nom).toLowerCase()
    const normPrenom = normalizeForSearch(prenom).toLowerCase()
    const match = allElus.find((e: any) =>
      normalizeForSearch(e.nom).toLowerCase() === normNom &&
      normalizeForSearch(e.prenom).toLowerCase() === normPrenom
    )
    if (match) return match.id

    const created = await createItem('elus', { nom, prenom })
    return created?.id
  }

  for (const c of pv.conseillers) {
    await findOrCreateElu(c.nom, c.prenom)
  }
  console.log(`   ✓ Conseillers OK`)

  // Présences
  console.log(`\n📋 Enregistrement des présences...`)
  for (const c of pv.conseillers) {
    const eluId = await findOrCreateElu(c.nom, c.prenom)
    if (!eluId) continue
    const existing = await getItems('presences', `filter[elu][_eq]=${eluId}&filter[seance][_eq]=${seanceId}&limit=1`)
    if (existing.length > 0) continue
    await createItem('presences', {
      elu: eluId, seance: seanceId,
      statut: c.statut === 'procuration' ? 'procuration' : c.statut === 'absent' ? 'absent' : 'present',
      procuration_a: c.procurationA || undefined,
    })
  }
  console.log(`   ✓ Présences OK`)

  // Thèmes
  const themeCache: Record<string, number> = {}
  for (const d of pv.deliberations) {
    const slug = classifyTheme(d.titre)
    if (!themeCache[slug]) {
      themeCache[slug] = await upsert('themes', `[slug][_eq]=${slug}`, { nom: slug, slug })
    }
  }

  // Délibérations
  const year = pv.seance.date.substring(0, 4)
  console.log(`\n📄 Import des délibérations...\n`)

  for (const d of pv.deliberations) {
    const numero = typeof d.numero === 'string' && (d.numero as string).includes('-')
      ? d.numero : `${year}-${String(d.numero).padStart(3, '0')}`

    const check = await getItems('deliberations', `filter[numero][_eq]=${numero}&limit=1`)
    if (check.length > 0) { console.log(`  ⏭ ${numero} — déjà importée`); continue }

    const themeSlug = classifyTheme(d.titre)
    const nbVotants = d.vote.pour || pv.conseillers.filter(c => c.statut !== 'absent').length
    const votePour = d.vote.type === 'unanimite' ? nbVotants : (d.vote.pour || 0)
    const voteContre = d.vote.type === 'unanimite' ? 0 : (d.vote.contre || 0)
    const voteAbstention = d.vote.type === 'unanimite' ? 0 : (d.vote.abstention || 0)

    let retranscription = ''
    if (d.debats?.length) {
      retranscription += 'Débats :\n'
      retranscription += d.debats.map(db => `• ${db.intervenant} : ${db.contenu}`).join('\n')
    }

    const montant = d.montants?.length
      ? d.montants.reduce((max, m) => m.montant > max ? m.montant : max, 0)
      : undefined

    const resp = await createItem('deliberations', {
      numero, titre: d.titre, resume_ia: d.texteResume,
      retranscription: retranscription || undefined,
      theme: themeCache[themeSlug], seance: seanceId,
      vote_pour: votePour, vote_contre: voteContre, vote_abstention: voteAbstention,
      budget_montant: montant || undefined, statut: 'publie',
    })

    if (resp?.id) {
      console.log(`  ✓ ${numero} — ${d.titre.substring(0, 60)}...`)
      // Votes nominatifs — uniquement si la source est un PV officiel.
      // Pour une transcription audio, on ne peut pas observer qui a levé la main,
      // donc on ne fabrique pas d'attribution nominative.
      if (pv.seance?.source !== 'transcription_audio') {
        const contreSet = new Set((d.vote.detailContre || []).map(n => n.trim()))
        const abstentionSet = new Set((d.vote.detailAbstention || []).map(n => n.trim()))
        for (const c of pv.conseillers) {
          const eluId = await findOrCreateElu(c.nom, c.prenom)
          if (!eluId) continue
          let choix = 'pour'
          if (c.statut === 'absent') choix = 'absent'
          else if (contreSet.has(`${c.prenom} ${c.nom}`)) choix = 'contre'
          else if (abstentionSet.has(`${c.prenom} ${c.nom}`)) choix = 'abstention'
          await createItem('votes_elus', { elu: eluId, deliberation: resp.id, choix })
        }
      }
    } else {
      console.error(`  ✗ ${numero}`)
    }
    await new Promise(r => setTimeout(r, 50))
  }
  console.log('\n✅ Import terminé !')
}

// CLI
async function main() {
  const jsonPath = process.argv[2]
  if (!jsonPath) { console.error('Usage: npx tsx import-pv-json.ts <json-file>'); process.exit(1) }
  await login()
  const pv = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'))
  await importPV(pv)
}

const isDirectRun = process.argv[1]?.includes('import-pv-json')
if (isDirectRun) {
  main().catch(err => { console.error('❌', err.message); process.exit(1) })
}

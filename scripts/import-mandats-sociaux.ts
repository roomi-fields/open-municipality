/**
 * Import des mandats sociaux des élus — source: recherche-entreprises.api.gouv.fr
 * Données 100% publiques (RCS, RNA, INSEE)
 * Usage : npx tsx import-mandats-sociaux.ts
 */

import { login, getItems, updateItem } from './lib/directus'

const API_URL = 'https://recherche-entreprises.api.gouv.fr/search'
const DEPARTEMENT = '32'
const COLLECTIVITE_LIJ = 1

function normalizeNom(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function sleep(ms: number) { return new Promise(r => setTimeout(r, ms)) }

interface MandatSocial {
  qualite: string
  entreprise: string
  siren: string
  nature_juridique?: string
  commune?: string
  activite?: string
  etat?: string
}

async function searchDirigeant(nom: string, prenom: string): Promise<MandatSocial[]> {
  const q = encodeURIComponent(`${nom} ${prenom}`)
  const url = `${API_URL}?q=${q}&departement=${DEPARTEMENT}&page=1&per_page=20`

  const resp = await fetch(url)
  if (!resp.ok) return []
  const data = await resp.json()

  const nomLower = normalizeNom(nom)
  const prenomLower = normalizeNom(prenom)
  const mandats: MandatSocial[] = []

  for (const r of data.results || []) {
    for (const dir of r.dirigeants || []) {
      const dirNom = normalizeNom(dir.nom || '')
      const dirPrenom = normalizeNom(dir.prenom || '')

      // Match: nom exact + prénom commence pareil (ou vide)
      const nomMatch = dirNom === nomLower || nomLower.includes(dirNom) || dirNom.includes(nomLower)
      const prenomMatch = !dirPrenom || dirPrenom === prenomLower || prenomLower.startsWith(dirPrenom) || dirPrenom.startsWith(prenomLower)

      if (nomMatch && prenomMatch) {
        // Éviter les doublons
        const siren = r.siren || ''
        if (mandats.some(m => m.siren === siren)) continue

        // Exclure les collectivités (la commune, l'interco, etc.)
        const nature = r.nature_juridique || ''
        if (nature.startsWith('7')) continue // Catégorie 7 = personnes morales de droit public

        mandats.push({
          qualite: dir.qualite || 'Dirigeant',
          entreprise: r.nom_complet || '',
          siren,
          nature_juridique: r.nature_juridique || '',
          commune: r.siege?.commune || '',
          activite: r.activite_principale || '',
          etat: r.etat_administratif || '',
        })
      }
    }
  }

  return mandats
}

async function main() {
  console.log('🏢 Import mandats sociaux des élus\n')
  console.log('   Source : recherche-entreprises.api.gouv.fr (RCS, RNA, INSEE)\n')

  await login()

  const allElus = await getItems('elus', 'limit=500')

  console.log(`👥 ${allElus.length} élus à rechercher\n`)

  let enriched = 0
  for (const elu of allElus.sort((a: any, b: any) => a.nom.localeCompare(b.nom))) {
    const mandats = await searchDirigeant(elu.nom, elu.prenom)

    if (mandats.length > 0) {
      console.log(`  ✓ ${elu.prenom} ${elu.nom}:`)
      for (const m of mandats) {
        const etat = m.etat === 'A' ? '' : ' [cessée]'
        console.log(`    → ${m.qualite} — ${m.entreprise} (${m.siren})${etat}`)
      }
      await updateItem('elus', elu.id, { mandats_sociaux: mandats })
      enriched++
    }

    await sleep(300) // respect rate limit
  }

  console.log(`\n✅ ${enriched} élus enrichis sur ${allElus.length}`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

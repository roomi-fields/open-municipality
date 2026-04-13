/**
 * Enrichissement des élus avec les données HATVP (déclarations d'intérêts).
 * Source : data.gouv.fr — Liste des responsables publics ayant effectué des déclarations
 * Usage : npx tsx import-hatvp.ts [--download]
 */

import * as fs from 'fs'
import * as path from 'path'
import { login, getItems, updateItem } from './lib/directus'

const HATVP_URL = 'https://www.data.gouv.fr/api/1/datasets/r/8583f5c6-5665-473b-9d3e-1d54bbc88a4a'
const DATA_DIR = path.resolve('../data')
const CSV_PATH = path.resolve(DATA_DIR, 'hatvp.csv')
const HATVP_BASE = 'https://www.hatvp.fr'

function normalizeNom(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ').toLowerCase().trim()
}

function parseCsv(filepath: string): Record<string, string>[] {
  const content = fs.readFileSync(filepath, 'utf-8')
  const lines = content.split('\n').filter(l => l.trim())
  const headers = lines[0].split(';').map(h => h.trim())
  return lines.slice(1).map(line => {
    const vals = line.split(';')
    const row: Record<string, string> = {}
    headers.forEach((h, i) => row[h] = (vals[i] || '').trim())
    return row
  })
}

async function main() {
  const args = process.argv.slice(2)
  const doDownload = args.includes('--download')

  console.log('📋 Import HATVP — Déclarations d\'intérêts\n')

  if (doDownload) {
    console.log('📥 Téléchargement du fichier HATVP...')
    const resp = await fetch(HATVP_URL, { redirect: 'follow' })
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    const buffer = Buffer.from(await resp.arrayBuffer())
    fs.writeFileSync(CSV_PATH, buffer)
    console.log(`   ✓ hatvp.csv (${(buffer.length / 1024).toFixed(0)} KB, ${buffer.toString().split('\n').length} lignes)\n`)
  }

  if (!fs.existsSync(CSV_PATH)) {
    console.error('❌ Fichier hatvp.csv introuvable. Lancez avec --download')
    process.exit(1)
  }

  await login()

  // Charger nos élus
  const elus = await getItems('elus', 'limit=500')
  console.log(`👥 ${elus.length} élus en base\n`)

  // Parser le CSV HATVP
  const hatvpRows = parseCsv(CSV_PATH)
  console.log(`📋 ${hatvpRows.length} entrées HATVP\n`)

  // Créer un index par nom normalisé
  // On garde uniquement la déclaration d'intérêts la plus récente (type_document = 'di')
  const hatvpMap = new Map<string, { url: string; statut: string; qualite: string; dept: string; photo?: string }>()

  for (const row of hatvpRows) {
    const key = normalizeNom(row.prenom) + '|' + normalizeNom(row.nom)
    const typeDoc = row.type_document

    // On privilégie les DI (déclarations d'intérêts) — les plus pertinentes pour la transparence
    if (typeDoc !== 'di') continue

    const existing = hatvpMap.get(key)
    // Garder la plus récente (par date de publication)
    if (existing && row.date_publication && existing.statut === 'Livrée') continue

    const urlDossier = row.url_dossier
    hatvpMap.set(key, {
      url: urlDossier ? `${HATVP_BASE}${urlDossier}` : '',
      statut: row.statut_publication || 'Inconnu',
      qualite: row.qualite || '',
      dept: row.departement || '',
      photo: row.url_photo || '',
    })
  }

  console.log(`🔍 ${hatvpMap.size} personnes avec DI dans HATVP\n`)

  // Croiser avec nos élus — filtrer par département 32 (Gers) ou mandats liés
  // On garde aussi les entrées sans département (cas EPCI inter-départementaux)
  const DEPT_GERS = '32'
  const KEYWORDS_LOCAL = ['gascogne', 'isle-jourdain', 'gers', 'occitanie']

  let matched = 0
  for (const elu of elus) {
    const key = normalizeNom(elu.prenom) + '|' + normalizeNom(elu.nom)
    const hatvp = hatvpMap.get(key)

    if (hatvp && hatvp.url) {
      // Vérifier que c'est bien un élu local (département 32 ou keywords locaux)
      const qualiteLower = hatvp.qualite.toLowerCase()
      const isLocal = hatvp.dept === DEPT_GERS
        || KEYWORDS_LOCAL.some(k => qualiteLower.includes(k))
      if (!isLocal) {
        console.log(`  ⏭ ${elu.prenom} ${elu.nom} — homonyme (${hatvp.qualite}, dept ${hatvp.dept})`)
        continue
      }

      console.log(`  ✓ ${elu.prenom} ${elu.nom} — ${hatvp.qualite}`)
      console.log(`    ${hatvp.url}`)
      console.log(`    Statut: ${hatvp.statut}`)

      await updateItem('elus', elu.id, {
        hatvp_url: hatvp.url,
        hatvp_statut: hatvp.statut,
      })
      matched++
    }
  }

  console.log(`\n✅ HATVP terminé ! ${matched} élus enrichis sur ${elus.length}`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

/**
 * Import des élus depuis le RNE — adapté pour Directus.
 * Usage : npx tsx import-rne.ts [--download]
 */

import * as fs from 'fs'
import * as path from 'path'
import { login, api, getItems, createItem, updateItem } from './lib/directus'

const RNE_URLS = {
  cm: 'https://www.data.gouv.fr/fr/datasets/r/d5f400de-ae3f-4966-8cb6-a85c70c6c24a',
  cc: 'https://www.data.gouv.fr/fr/datasets/r/41d95d7d-b172-4636-ac44-32656367cdc7',
  cd: 'https://www.data.gouv.fr/fr/datasets/r/601ef073-d986-4582-8e1a-ed14dc857fba',
}

const DATA_DIR = path.resolve('../data/rne')
const CODES_CANTON = ['32016','32038','32090','32105','32121','32134','32160','32210','32234','32268','32334','32339','32425']
const SIREN_CCGT = '200023620'
const CODE_CANTON_CD = '3213'

async function downloadCsv(url: string, destPath: string): Promise<void> {
  const filename = path.basename(destPath)
  if (fs.existsSync(destPath)) {
    const ageHours = (Date.now() - fs.statSync(destPath).mtimeMs) / (1000 * 60 * 60)
    if (ageHours < 24) { console.log(`   ⏭ ${filename} — récent`); return }
  }
  console.log(`   📥 Téléchargement ${filename}...`)
  const resp = await fetch(url, { redirect: 'follow' })
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
  const buffer = Buffer.from(await resp.arrayBuffer())
  fs.mkdirSync(path.dirname(destPath), { recursive: true })
  fs.writeFileSync(destPath, buffer)
  console.log(`   ✓ ${filename} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)`)
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

function normalizeNom(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ').toLowerCase().trim()
}

function parseRoleCM(fonction: string): { role: string; ordreAdjoint?: number } {
  if (fonction === 'Maire') return { role: 'maire' }
  const adjMatch = fonction.match(/(\d+)(?:er|ème|e) adjoint/i)
  if (adjMatch) return { role: 'adjoint', ordreAdjoint: parseInt(adjMatch[1]) }
  return { role: 'conseiller' }
}

function parseRoleCC(fonction: string): string {
  if (fonction.includes('Vice-président') || fonction.includes('vice-président')) return 'vice_president'
  if (fonction.includes('Président') || fonction.includes('président')) return 'president'
  return 'conseiller_communautaire'
}

async function main() {
  const args = process.argv.slice(2)
  const doDownload = args.includes('--download')

  console.log('🗃️  Import RNE — Directus\n')
  await login()

  if (doDownload) {
    console.log('📥 Téléchargement des CSV RNE...\n')
    await downloadCsv(RNE_URLS.cm, path.resolve(DATA_DIR, 'rne-cm.csv'))
    await downloadCsv(RNE_URLS.cc, path.resolve(DATA_DIR, 'rne-cc.csv'))
    await downloadCsv(RNE_URLS.cd, path.resolve(DATA_DIR, 'rne-cd.csv'))
  }

  // Charger collectivités
  const collectivites = await getItems('collectivites', 'limit=200')
  const findColl = (code: string) => collectivites.find((c: any) => c.code_insee === code)
  const interco = collectivites.find((c: any) => c.nom?.includes('Gascogne'))
  const canton = collectivites.find((c: any) => c.type === 'canton')

  if (!interco || !canton) { console.error('❌ Interco ou canton non trouvé. Lancez le seed.'); process.exit(1) }

  type EluData = {
    nom: string; prenom: string; mandats: any[]
    sexe?: string; date_naissance?: string; profession?: string
    date_debut_mandat?: string
  }
  const elusMap: Map<string, EluData> = new Map()

  function getOrInitElu(nom: string, prenom: string): EluData {
    const key = normalizeNom(prenom) + '|' + normalizeNom(nom)
    if (!elusMap.has(key)) elusMap.set(key, { nom, prenom, mandats: [] })
    return elusMap.get(key)!
  }

  function enrichElu(elu: EluData, row: Record<string, string>) {
    const sexe = row['Code sexe']
    if (sexe && !elu.sexe) elu.sexe = sexe === 'M' ? 'M' : 'F'
    const dn = row['Date de naissance']
    if (dn && !elu.date_naissance) elu.date_naissance = dn
    const prof = row['Libellé de la catégorie socio-professionnelle']
    if (prof && !elu.profession) elu.profession = prof
    const ddm = row['Date de début du mandat']
    if (ddm && !elu.date_debut_mandat) elu.date_debut_mandat = ddm
  }

  // 1. Conseillers municipaux
  console.log('👥 Conseillers municipaux...')
  const cm = parseCsv(path.resolve(DATA_DIR, 'rne-cm.csv'))
  const cmCanton = cm.filter(r => CODES_CANTON.includes(r['Code de la commune']))
  for (const row of cmCanton) {
    const commune = findColl(row['Code de la commune'])
    if (!commune) continue
    const { role, ordreAdjoint } = parseRoleCM(row["Libellé de la fonction"] || '')
    const elu = getOrInitElu(row["Nom de l'élu"], row["Prénom de l'élu"])
    enrichElu(elu, row)
    elu.mandats.push({ collectivite: commune.id, role, ordreAdjoint, commune: commune.nom, date_debut: row['Date de début du mandat'] || '', date_fonction: row['Date de début de la fonction'] || '' })
  }
  console.log(`   ${cmCanton.length} conseillers`)

  // 2. Conseillers communautaires
  console.log('👥 Conseillers communautaires...')
  const cc = parseCsv(path.resolve(DATA_DIR, 'rne-cc.csv'))
  const ccGT = cc.filter(r => r['N° SIREN'] === SIREN_CCGT)
  for (const row of ccGT) {
    const role = parseRoleCC(row["Libellé de la fonction"] || '')
    const elu = getOrInitElu(row["Nom de l'élu"], row["Prénom de l'élu"])
    enrichElu(elu, row)
    elu.mandats.push({ collectivite: interco.id, role, commune: row['Libellé de la commune de rattachement'] || '', date_debut: row['Date de début du mandat'] || '', date_fonction: row['Date de début de la fonction'] || '' })
  }
  console.log(`   ${ccGT.length} conseillers`)

  // 3. Conseillers départementaux
  console.log('👥 Conseillers départementaux...')
  const cd = parseCsv(path.resolve(DATA_DIR, 'rne-cd.csv'))
  const cdCanton = cd.filter(r => r['Code du canton'] === CODE_CANTON_CD)
  for (const row of cdCanton) {
    const elu = getOrInitElu(row["Nom de l'élu"], row["Prénom de l'élu"])
    enrichElu(elu, row)
    elu.mandats.push({ collectivite: canton.id, role: 'conseiller_departemental', delegations: row["Libellé de la fonction"] || '', date_debut: row['Date de début du mandat'] || '', date_fonction: row['Date de début de la fonction'] || '' })
  }
  console.log(`   ${cdCanton.length} conseillers`)

  // 4. Écriture en base (batch)
  console.log(`\n📝 Écriture de ${elusMap.size} élus en batch...`)

  // Re-login car le parsing CSV a pris du temps
  console.log('   Re-login...')
  try {
    await login()
    console.log('   ✓ Login OK')
  } catch (e: any) {
    console.error('   ✗ Login failed:', e.message, e.cause ? `cause: ${JSON.stringify(e.cause)}` : '')
    process.exit(1)
  }

  // Charger tous les élus existants d'un coup
  const existingElus = await getItems('elus', 'limit=500')
  const existingMap = new Map<string, number>()
  for (const e of existingElus) {
    existingMap.set(`${normalizeNom(e.prenom)}|${normalizeNom(e.nom)}`, e.id)
  }

  let created = 0, updated = 0
  const toCreate: any[] = []

  for (const [, data] of elusMap) {
    const key = `${normalizeNom(data.prenom)}|${normalizeNom(data.nom)}`
    const payload: any = { nom: data.nom, prenom: data.prenom, mandats: data.mandats }
    if (data.sexe) payload.sexe = data.sexe
    if (data.date_naissance) payload.date_naissance = data.date_naissance
    if (data.profession) payload.profession = data.profession
    if (data.date_debut_mandat) payload.date_debut_mandat = data.date_debut_mandat

    if (existingMap.has(key)) {
      await updateItem('elus', existingMap.get(key)!, payload)
      updated++
    } else {
      toCreate.push(payload)
    }
  }

  // Créer en batch (Directus supporte les arrays)
  if (toCreate.length > 0) {
    // Batch par lots de 50
    for (let i = 0; i < toCreate.length; i += 50) {
      const batch = toCreate.slice(i, i + 50)
      await api('POST', '/items/elus', batch)
      created += batch.length
      console.log(`   ${created}/${toCreate.length} créés...`)
    }
  }

  console.log(`\n✅ Import RNE terminé ! ${created} créés, ${updated} mis à jour`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

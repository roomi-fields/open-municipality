/**
 * Scraper automatisé des prochaines séances + ordres du jour.
 *
 * Détecte :
 *   - Dates des prochaines séances CM (LIJ) et CC (CCGT)
 *   - PDFs d'ordre du jour / dossier de séance
 * Pour chaque OJ détecté : download + parse Claude → upsert seance.ordre_jour_items
 *
 * Idempotent. État dans data/seances-state.json.
 *
 * Cron suggéré : toutes les 6h.
 *   crontab -e
 *   0 *\/6 * * * cd /path/to/scripts && /usr/bin/npx tsx scraper-seances.ts >> /var/log/scraper.log 2>&1
 */

import fs from 'fs'
import path from 'path'
import { login, getItems, createItem, updateItem } from './lib/directus'

// Charger .env
const envPath = path.resolve('../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const DATA_DIR = path.resolve('../data')
const STATE_FILE = path.resolve(DATA_DIR, 'seances-state.json')
const PDF_DIR = path.resolve(DATA_DIR, 'ordre-jour')

interface PdfState { url: string; sha?: string; processedAt?: string; error?: string; items?: number }
interface State { lastCheck: string; pdfs: Record<string, PdfState> }

function loadState(): State {
  try { return JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8')) } catch { return { lastCheck: '', pdfs: {} } }
}
function saveState(s: State) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(s, null, 2))
}

const SOURCES = [
  {
    key: 'lij',
    name: "L'Isle-Jourdain",
    url: 'https://www.mairie-islejourdain.fr/seances-conseil-municipal',
    baseUrl: 'https://www.mairie-islejourdain.fr',
    type: 'conseil_municipal' as const,
    collectiviteFilter: 'filter[code_insee][_eq]=32160',
    ojPattern: /Ordre[_-]?du[_-]?jour/i,
    lieu: 'Salle du Conseil municipal',
    heure: '20:30',
  },
  {
    key: 'ccgt',
    name: 'CC Gascogne Toulousaine',
    url: 'https://www.ccgascognetoulousaine.com/la-gascogne-toulousaine/lorganisation-politique/les-seances-du-conseil-communautaire/',
    baseUrl: 'https://www.ccgascognetoulousaine.com',
    type: 'conseil_communautaire' as const,
    collectiviteFilter: 'filter[nom][_contains]=Gascogne',
    ojPattern: /Dossier[_-]?de[_-]?seance|Ordre[_-]?du[_-]?jour/i,
    lieu: 'Salle du Conseil communautaire CCGT',
    heure: '18:30',
  },
]

const MOIS: Record<string, string> = {
  janvier: '01', février: '02', fevrier: '02', mars: '03', avril: '04', mai: '05', juin: '06',
  juillet: '07', août: '08', aout: '08', septembre: '09', octobre: '10', novembre: '11', décembre: '12', decembre: '12',
}

function extractDates(html: string): string[] {
  const out = new Set<string>()
  const today = new Date().toISOString().slice(0, 10)
  const rx = /(\d{1,2})\s+(janvier|février|fevrier|mars|avril|mai|juin|juillet|août|aout|septembre|octobre|novembre|décembre|decembre)\s+(\d{4})/gi
  let m
  while ((m = rx.exec(html)) !== null) {
    const date = `${m[3]}-${MOIS[m[2].toLowerCase()]}-${m[1].padStart(2, '0')}`
    if (date >= today) out.add(date)
  }
  return [...out]
}

function extractPdfUrls(html: string, baseUrl: string, pattern: RegExp): { url: string; filename: string }[] {
  const out: { url: string; filename: string }[] = []
  const seen = new Set<string>()
  const rx = /href=["']([^"']*\.pdf)["']/gi
  let m
  while ((m = rx.exec(html)) !== null) {
    let url = m[1]
    if (url.startsWith('/')) url = baseUrl + url
    else if (!url.startsWith('http')) url = baseUrl + '/' + url
    const filename = decodeURIComponent(url.split('/').pop() || '')
    if (pattern.test(filename) && !seen.has(url)) {
      seen.add(url)
      out.push({ url, filename })
    }
  }
  return out
}

function extractDateFromFilename(filename: string): string | null {
  // 2026-04-16-Ordre_du_jour_CM.pdf
  let m = filename.match(/(\d{4})[-_](\d{2})[-_](\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  // Dossier_de_seance_du_19-02-2026
  m = filename.match(/(\d{2})[-_](\d{2})[-_](\d{4})/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return null
}

async function parseOJWithClaude(pdfBuffer: Buffer): Promise<{ section: string; numero: number; titre: string }[]> {
  const key = process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY manquante')
  const base64 = pdfBuffer.toString('base64')

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 4000,
      messages: [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
          { type: 'text', text: `Extrais l'ordre du jour de ce PDF et retourne UNIQUEMENT un JSON array de ce format :
[
  {"section": "Affaires générales", "numero": 1, "titre": "Approbation du procès-verbal"},
  ...
]
Les sections sont les regroupements thématiques (lettres A, B, C ou titres en majuscules). Les numéros sont les numéros des points. Le titre doit être l'intitulé officiel sans la numérotation. Aucun texte autour du JSON.` }
        ],
      }],
    }),
  })
  if (!resp.ok) throw new Error(`Claude API ${resp.status} — ${(await resp.text()).substring(0, 200)}`)
  const data = await resp.json()
  const text = data.content?.[0]?.text || ''
  const m = text.match(/\[[\s\S]*\]/)
  if (!m) throw new Error('Pas de JSON dans la réponse')
  return JSON.parse(m[0])
}

async function getCollectiviteId(filter: string): Promise<number> {
  const items = await getItems('collectivites', filter + '&limit=1')
  if (!items[0]) throw new Error(`Collectivité introuvable : ${filter}`)
  return items[0].id
}

async function upsertSeance(date: string, type: string, collId: number, lieu: string, ojItems?: any[]) {
  const existing = await getItems('seances', `filter[date][_eq]=${date}&filter[collectivite][_eq]=${collId}&limit=1`)
  const payload: any = { date, type, collectivite: collId, statut: 'a_venir', lieu }
  if (ojItems) payload.ordre_jour_items = ojItems
  if (existing[0]) {
    await updateItem('seances', existing[0].id, payload)
    return { id: existing[0].id, action: 'updated' }
  }
  const created = await createItem('seances', payload)
  return { id: created.id, action: 'created' }
}

async function processSource(src: typeof SOURCES[0], state: State) {
  console.log(`\n🏛  ${src.name}`)
  let html: string
  try {
    const resp = await fetch(src.url)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    html = await resp.text()
  } catch (e: any) { console.error(`  ❌ fetch: ${e.message}`); return }

  const dates = extractDates(html)
  const pdfs = extractPdfUrls(html, src.baseUrl, src.ojPattern)
  console.log(`  📅 ${dates.length} date(s) future(s), 📄 ${pdfs.length} PDF(s) OJ`)

  const collId = await getCollectiviteId(src.collectiviteFilter)

  // Créer les seances détectées (sans OJ pour les non-couverts par PDF)
  for (const date of dates) {
    const r = await upsertSeance(date, src.type, collId, src.lieu)
    if (r.action === 'created') console.log(`  ➕ Séance ${date}`)
  }

  // Traiter les OJ
  fs.mkdirSync(PDF_DIR, { recursive: true })
  for (const pdf of pdfs) {
    const date = extractDateFromFilename(pdf.filename)
    if (!date) { console.log(`  ⚠ OJ sans date : ${pdf.filename}`); continue }

    const st = state.pdfs[pdf.url]
    if (st?.processedAt && !st.error) { console.log(`  ⏭ ${pdf.filename} (déjà traité, ${st.items} pts)`); continue }

    state.pdfs[pdf.url] = { url: pdf.url }
    try {
      console.log(`  📥 ${pdf.filename}`)
      const buf = Buffer.from(await (await fetch(pdf.url)).arrayBuffer())
      fs.writeFileSync(path.resolve(PDF_DIR, pdf.filename), buf)
      const items = await parseOJWithClaude(buf)
      await upsertSeance(date, src.type, collId, src.lieu, items)
      state.pdfs[pdf.url] = { url: pdf.url, processedAt: new Date().toISOString(), items: items.length }
      console.log(`  ✅ ${date} — ${items.length} points importés`)
    } catch (e: any) {
      state.pdfs[pdf.url].error = e.message.substring(0, 200)
      console.error(`  ❌ ${pdf.filename} : ${e.message}`)
    }
    saveState(state)
  }
}

async function main() {
  console.log(`🔄 Scraper séances — ${new Date().toISOString()}\n`)
  await login()
  const state = loadState()
  for (const src of SOURCES) await processSource(src, state)
  state.lastCheck = new Date().toISOString()
  saveState(state)
  console.log('\n✅ Terminé')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })

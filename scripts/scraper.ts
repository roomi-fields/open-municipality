/**
 * Scraper automatique des délibérations — Mairie + Interco
 *
 * Usage :
 *   npx tsx src/lib/scraper.ts           # scrape les deux sites
 *   npx tsx src/lib/scraper.ts --mairie  # mairie uniquement
 *   npx tsx src/lib/scraper.ts --interco # interco uniquement
 *
 * En cron : toutes les 12h par exemple
 */

import fs from 'fs'
import path from 'path'

import { login, getItems, createItem } from './lib/directus'

const DATA_DIR = path.resolve('../data')
const STATE_FILE = path.resolve(DATA_DIR, 'scraper-state.json')

// ── URLs à scraper ─────────────────────────────────────────

const SOURCES = {
  mairie: {
    name: 'Mairie de L\'Isle-Jourdain',
    baseUrl: 'https://www.mairie-islejourdain.fr',
    pagesUrl: 'https://www.mairie-islejourdain.fr/seances-conseil-municipal',
    filesBaseUrl: 'https://www.mairie-islejourdain.fr/sites/default/files/',
    codeInsee: '32160',
    type: 'conseil_municipal' as const,
  },
  interco: {
    name: 'CC Gascogne Toulousaine',
    baseUrl: 'https://www.ccgascognetoulousaine.com',
    pagesUrl: 'https://www.ccgascognetoulousaine.com/la-gascogne-toulousaine/lorganisation-politique/les-seances-du-conseil-communautaire/',
    filesBaseUrl: '',
    codeInsee: null,
    type: 'conseil_communautaire' as const,
  },
}

// ── State management ───────────────────────────────────────

export interface FileState {
  status: 'discovered' | 'processing' | 'processed' | 'error' | 'skipped'
  source: 'mairie' | 'interco'
  discoveredAt: string
  processedAt?: string
  error?: string
  lastAttempt?: string
  jsonPath?: string
}

export interface ScraperState {
  lastCheck: string
  files: Record<string, FileState>
  // Ancien format conservé pour migration
  knownFiles?: string[]
}

export function loadState(): ScraperState {
  try {
    const raw = JSON.parse(fs.readFileSync(STATE_FILE, 'utf-8'))

    // Migration de l'ancien format knownFiles → files
    if (raw.knownFiles && !raw.files) {
      console.log('  🔄 Migration du format scraper-state...')
      const files: Record<string, FileState> = {}
      for (const url of raw.knownFiles) {
        const source = url.includes('mairie-islejourdain') ? 'mairie' : 'interco'
        files[url] = {
          status: 'discovered',
          source,
          discoveredAt: raw.lastCheck || new Date().toISOString(),
        }
      }
      return { lastCheck: raw.lastCheck || '', files }
    }

    return raw
  } catch {
    return { lastCheck: '', files: {} }
  }
}

export function saveState(state: ScraperState) {
  // Ne plus sauvegarder knownFiles dans le nouveau format
  const { knownFiles, ...clean } = state
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(STATE_FILE, JSON.stringify(clean, null, 2))
}

// ── HTML scraping (sans dépendance) ────────────────────────

async function fetchPage(url: string): Promise<string> {
  console.log(`  📡 Fetch ${url}`)
  const resp = await fetch(url)
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${url}`)
  return resp.text()
}

function extractPdfLinks(html: string, baseUrl: string): { url: string; filename: string }[] {
  const links: { url: string; filename: string }[] = []
  // Match href="...pdf" ou href="...PDF"
  const regex = /href=["']([^"']*\.pdf)["']/gi
  let match
  while ((match = regex.exec(html)) !== null) {
    let url = match[1]
    // Résoudre les URLs relatives
    if (url.startsWith('/')) {
      url = baseUrl + url
    } else if (!url.startsWith('http')) {
      url = baseUrl + '/' + url
    }
    const filename = url.split('/').pop() || ''
    // Filtrer : on veut les délibérations, PV, ordres du jour
    const lower = filename.toLowerCase()
    if (lower.includes('deliberation') || lower.includes('pv') ||
        lower.includes('ordre') || lower.includes('liste') ||
        lower.includes('dossier') || lower.includes('compte')) {
      links.push({ url, filename })
    }
  }
  return links
}

function extractUpcomingSessions(html: string): { date: string; lieu: string }[] {
  const sessions: { date: string; lieu: string }[] = []
  // Chercher les dates au format DD/MM/YYYY ou "7 avril 2026"
  const dateRegex = /(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/gi
  const months: Record<string, string> = {
    'janvier': '01', 'février': '02', 'mars': '03', 'avril': '04',
    'mai': '05', 'juin': '06', 'juillet': '07', 'août': '08',
    'septembre': '09', 'octobre': '10', 'novembre': '11', 'décembre': '12',
  }
  let match
  while ((match = dateRegex.exec(html)) !== null) {
    const day = match[1].padStart(2, '0')
    const month = months[match[2].toLowerCase()]
    const year = match[3]
    if (month && parseInt(year) >= 2025) {
      sessions.push({ date: `${year}-${month}-${day}`, lieu: '' })
    }
  }
  return sessions
}

// ── Notification de nouveaux documents ─────────────────────

async function notifyNewDocument(source: string, filename: string, url: string) {
  console.log(`  🆕 Nouveau document détecté : ${filename}`)
  console.log(`     Source : ${source}`)
  console.log(`     URL : ${url}`)

  const notifPath = path.resolve(DATA_DIR, 'notifications.log')
  const line = `[${new Date().toISOString()}] ${source} — ${filename} — ${url}\n`
  fs.appendFileSync(notifPath, line)
}

async function notifyUpcomingSession(source: string, date: string) {
  console.log(`  📅 Prochaine séance détectée : ${date}`)

  // Créer la séance dans Directus si elle n'existe pas
  const collectivites = await getItems('collectivites',
    source === 'mairie'
      ? 'filter[code_insee][_eq]=32160&limit=1'
      : 'filter[type][_eq]=interco&limit=1'
  )
  const collectiviteId = collectivites[0]?.id
  if (!collectiviteId) return

  const seanceType = source === 'mairie' ? 'conseil_municipal' : 'conseil_communautaire'
  const existing = await getItems('seances',
    `filter[date][_eq]=${date}&filter[type][_eq]=${seanceType}&limit=1`
  )

  if (existing.length === 0) {
    await createItem('seances', {
      date,
      type: seanceType,
      collectivite: collectiviteId,
      statut: 'a_venir',
    })
    console.log(`     ✓ Séance créée dans Directus`)
  }
}

// ── Scraper principal ──────────────────────────────────────

async function scrapeSite(sourceKey: 'mairie' | 'interco', state: ScraperState) {
  const source = SOURCES[sourceKey]
  console.log(`\n🏛  Scraping ${source.name}...`)

  try {
    const html = await fetchPage(source.pagesUrl)

    // 1. Chercher les nouveaux PDFs
    const pdfLinks = extractPdfLinks(html, source.baseUrl)
    console.log(`  📄 ${pdfLinks.length} PDFs trouvés`)

    let newCount = 0
    for (const link of pdfLinks) {
      if (!state.files[link.url]) {
        state.files[link.url] = {
          status: 'discovered',
          source: sourceKey,
          discoveredAt: new Date().toISOString(),
        }
        await notifyNewDocument(source.name, link.filename, link.url)
        newCount++
      }
    }

    if (newCount === 0) {
      console.log(`  ✓ Pas de nouveau document`)
    } else {
      console.log(`  🆕 ${newCount} nouveau(x) document(s)`)
    }

    // 2. Chercher les prochaines séances
    const sessions = extractUpcomingSessions(html)
    const today = new Date().toISOString().split('T')[0]
    const upcoming = sessions.filter(s => s.date >= today)

    if (upcoming.length > 0) {
      console.log(`  📅 ${upcoming.length} séance(s) à venir`)
      for (const session of upcoming) {
        await notifyUpcomingSession(sourceKey, session.date)
      }
    }

  } catch (err: any) {
    console.error(`  ❌ Erreur : ${err.message}`)
  }
}

// ── Scraper des anciens PV (pour import historique) ────────

async function scrapeArchiveLinks(sourceKey: 'mairie' | 'interco'): Promise<string[]> {
  const source = SOURCES[sourceKey]
  console.log(`\n📚 Scan des archives ${source.name}...`)

  const html = await fetchPage(source.pagesUrl)
  const allPdfs = extractPdfLinks(html, source.baseUrl)

  // Filtrer les PV uniquement
  const pvLinks = allPdfs.filter(l => l.filename.toLowerCase().includes('pv'))
  console.log(`  📄 ${pvLinks.length} PV trouvés dans les archives`)

  return pvLinks.map(l => l.url)
}

// ── Main ───────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const doMairie = args.length === 0 || args.includes('--mairie')
  const doInterco = args.length === 0 || args.includes('--interco')
  const doArchives = args.includes('--archives')

  console.log('🔍 Scraper Open Municipality')
  console.log(`   Date : ${new Date().toISOString()}`)

  await login()
  fs.mkdirSync(DATA_DIR, { recursive: true })
  const state = loadState()

  if (doArchives) {
    // Mode archives : lister tous les PV disponibles
    if (doMairie) {
      const pvUrls = await scrapeArchiveLinks('mairie')
      pvUrls.forEach(url => console.log(`  ${url}`))
    }
    if (doInterco) {
      const pvUrls = await scrapeArchiveLinks('interco')
      pvUrls.forEach(url => console.log(`  ${url}`))
    }
  } else {
    // Mode normal : détecter les nouveaux documents
    if (doMairie) await scrapeSite('mairie', state)
    if (doInterco) await scrapeSite('interco', state)
  }

  state.lastCheck = new Date().toISOString()
  saveState(state)

  console.log(`\n✅ Scraping terminé — ${state.lastCheck}`)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})

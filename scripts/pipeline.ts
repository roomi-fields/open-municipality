/**
 * Pipeline automatisé : scrape → parse → import (Directus).
 * Usage : ANTHROPIC_API_KEY=sk-ant-... npx tsx pipeline.ts
 */

import fs from 'fs'
import path from 'path'
import { loadState, saveState, type FileState, type ScraperState } from './scraper'
import { downloadPdf, parsePvWithClaude } from './parse-pv'
import { login } from './lib/directus'
import { importPV } from './import-pv-json'

const MAX_PER_CYCLE = parseInt(process.env.PIPELINE_MAX || '3')
const RETRY_AFTER_HOURS = 24
const PDF_DIR = path.resolve('../data/pdfs')

function isPvFile(url: string): boolean {
  const filename = decodeURIComponent(url.split('/').pop() || '').toLowerCase()
  return filename.includes('pv') || filename.includes('proces-verbal')
}

function shouldProcess(file: FileState): boolean {
  if (file.status === 'processed' || file.status === 'skipped' || file.status === 'processing') return false
  if (file.status === 'error' && file.lastAttempt) {
    return (Date.now() - new Date(file.lastAttempt).getTime()) / 3600000 >= RETRY_AFTER_HOURS
  }
  return true
}

function detectSeanceType(url: string): 'conseil_municipal' | 'conseil_communautaire' {
  return url.includes('mairie-islejourdain') ? 'conseil_municipal' : 'conseil_communautaire'
}

async function processPdf(url: string, file: FileState, state: ScraperState): Promise<void> {
  const filename = decodeURIComponent(url.split('/').pop() || 'unknown.pdf')
  console.log(`\n📄 ${filename}`)

  file.status = 'processing'
  file.lastAttempt = new Date().toISOString()
  saveState(state)

  try {
    const pdfBuffer = await downloadPdf(url)
    fs.mkdirSync(PDF_DIR, { recursive: true })
    fs.writeFileSync(path.resolve(PDF_DIR, filename), pdfBuffer)

    const parsed = await parsePvWithClaude(pdfBuffer)
    parsed.seance.type = detectSeanceType(url)

    const jsonPath = path.resolve('../data', `pv-${parsed.seance.date}-${file.source}.json`)
    fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2))

    await importPV(parsed, { seanceType: parsed.seance.type as any })

    file.status = 'processed'
    file.processedAt = new Date().toISOString()
    file.jsonPath = jsonPath
    saveState(state)
    console.log(`   ✅ Terminé`)
  } catch (err: any) {
    console.error(`   ❌ ${err.message}`)
    file.status = 'error'
    file.error = err.message.substring(0, 200)
    saveState(state)
  }
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY manquante'); process.exit(1)
  }

  console.log('🔄 Pipeline Open Municipality (Directus)\n')
  await login()

  const state = loadState()
  const toProcess: [string, FileState][] = []

  for (const [url, file] of Object.entries(state.files)) {
    if (!isPvFile(url)) { if (file.status === 'discovered') file.status = 'skipped'; continue }
    if (shouldProcess(file)) toProcess.push([url, file])
  }

  if (!toProcess.length) { console.log('✅ Aucun nouveau PV'); saveState(state); return }

  console.log(`🔄 ${toProcess.length} PV(s) à traiter (max ${MAX_PER_CYCLE})`)
  let processed = 0

  for (const [url, file] of toProcess) {
    if (processed >= MAX_PER_CYCLE) break
    await processPdf(url, file, state)
    processed++
    if (processed < Math.min(toProcess.length, MAX_PER_CYCLE)) {
      await new Promise(r => setTimeout(r, 5000))
    }
  }

  saveState(state)
  console.log(`\n✅ ${processed} PDF(s) traité(s)`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

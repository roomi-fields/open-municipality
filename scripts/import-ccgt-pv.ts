/**
 * Import du PV CCGT 2026-04-07 via le pipeline standard.
 */
import fs from 'fs'
import path from 'path'
import { parsePvWithClaude } from './parse-pv'
// Load .env manually
const envPath = path.resolve('../.env')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z_]+)=(.*)$/)
    if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
import { login } from './lib/directus'
import { importPV } from './import-pv-json'

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY manquante'); process.exit(1)
  }
  const pdfPath = path.resolve('../data/pvs/CCGT_PV_2026-04-07_election.pdf')
  const pdfBuffer = fs.readFileSync(pdfPath)
  console.log(`📄 ${pdfPath} (${(pdfBuffer.length / 1024).toFixed(0)} KB)\n`)

  await login()
  const parsed = await parsePvWithClaude(pdfBuffer)
  parsed.seance.type = 'conseil_communautaire'

  const jsonPath = path.resolve('../data/pv-2026-04-07-ccgt.json')
  fs.writeFileSync(jsonPath, JSON.stringify(parsed, null, 2))
  console.log(`💾 JSON sauvegardé : ${jsonPath}`)
  console.log(`   ${parsed.deliberations.length} délibérations, ${parsed.conseillers.length} conseillers\n`)

  await importPV(parsed, { seanceType: 'conseil_communautaire' })
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

/**
 * Parse un procès-verbal de conseil municipal via Claude API.
 *
 * Usage CLI : ANTHROPIC_API_KEY=sk-ant-... npx tsx src/lib/parse-pv.ts <url-ou-chemin-pdf>
 *
 * Peut aussi être importé comme module :
 *   import { downloadPdf, parsePvWithClaude, type ParsedPV } from './parse-pv'
 */

import fs from 'fs'
import path from 'path'

// ── Types exportés ───────────────────────────────────────────

export interface ParsedPV {
  seance: {
    date: string // ISO
    heure: string
    lieu: string
    type?: string // conseil_municipal | conseil_communautaire
    codeInsee?: string
    source?: 'pdf_officiel' | 'transcription_audio'
  }
  conseillers: {
    nom: string
    prenom: string
    statut: 'present' | 'absent' | 'procuration'
    procurationA?: string // nom du mandataire
  }[]
  deliberations: {
    numero: number
    titre: string
    texteResume: string // résumé du contenu
    vote: {
      type: 'unanimite' | 'majorite'
      pour?: number
      contre?: number
      abstention?: number
      detailContre?: string[] // noms
      detailAbstention?: string[] // noms
    }
    montants?: { description: string; montant: number }[]
    debats?: { intervenant: string; contenu: string }[]
  }[]
}

// ── Télécharger le PDF ─────────────────────────────────────

export async function downloadPdf(urlOrPath: string): Promise<Buffer> {
  if (urlOrPath.startsWith('http')) {
    console.log(`📥 Téléchargement de ${urlOrPath}...`)
    const resp = await fetch(urlOrPath)
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
    return Buffer.from(await resp.arrayBuffer())
  }
  return fs.readFileSync(urlOrPath)
}

// ── Envoyer à Claude pour extraction ───────────────────────

export async function parsePvWithClaude(pdfBuffer: Buffer, apiKey?: string): Promise<ParsedPV> {
  const key = apiKey || process.env.ANTHROPIC_API_KEY
  if (!key) throw new Error('ANTHROPIC_API_KEY manquante')

  const base64 = pdfBuffer.toString('base64')

  console.log(`🤖 Envoi à Claude pour extraction (${(pdfBuffer.length / 1024 / 1024).toFixed(1)} MB)...`)

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5-20250514',
      max_tokens: 16000,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64,
            },
          },
          {
            type: 'text',
            text: `Tu es un extracteur de données de procès-verbaux de conseil municipal français.

Analyse ce procès-verbal et retourne un JSON structuré avec :

1. **seance** : date (format YYYY-MM-DD), heure, lieu

2. **conseillers** : liste complète extraite de la section "APPEL" avec pour chacun :
   - nom, prenom, statut (present/absent/procuration)
   - si procuration : le nom du mandataire (procurationA)

3. **deliberations** : pour CHAQUE délibération numérotée :
   - numero (entier)
   - titre (l'intitulé officiel)
   - texteResume (résumé en 2-3 phrases en français simple de ce qui a été décidé)
   - vote : type (unanimite ou majorite), et si majorite : pour, contre, abstention (nombres), detailContre (noms), detailAbstention (noms)
   - montants : liste des montants financiers mentionnés [{description, montant}]
   - debats : si des élus sont intervenus, liste [{intervenant, contenu (résumé en 1-2 phrases)}]

IMPORTANT :
- Extrais TOUTES les délibérations, pas seulement les premières
- Les débats sont en italique dans le PV (interventions des élus)
- Les votes détaillés apparaissent sous la forme "MAJORITE ABSOLUE PAR X VOIX POUR, Y CONTRE DONT..."
- Quand c'est "A L'UNANIMITE", mets type: "unanimite"

Retourne UNIQUEMENT le JSON valide, sans texte autour, sans markdown.`,
          },
        ],
      }],
    }),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Claude API error: ${resp.status} — ${err.substring(0, 200)}`)
  }

  const data = await resp.json()
  const text = data.content?.[0]?.text || ''

  // Extraire le JSON (Claude peut ajouter du texte autour)
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Pas de JSON trouvé dans la réponse Claude')

  return JSON.parse(jsonMatch[0])
}

// ── Main (usage CLI direct) ──────────────────────────────────

async function main() {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) {
    console.error('❌ Variable ANTHROPIC_API_KEY manquante.')
    console.error('Usage : ANTHROPIC_API_KEY=sk-ant-... npx tsx src/lib/parse-pv.ts <pdf>')
    process.exit(1)
  }

  const pdfSource = process.argv[2] || 'https://www.mairie-islejourdain.fr/sites/default/files/2025-12-16-PV.pdf'
  console.log('🏛  Parse du procès-verbal — L\'Isle-Jourdain\n')

  const pdfBuffer = await downloadPdf(pdfSource)
  console.log(`📄 PDF chargé (${(pdfBuffer.length / 1024).toFixed(0)} KB)\n`)

  const parsed = await parsePvWithClaude(pdfBuffer, ANTHROPIC_API_KEY)

  // Sauvegarder le JSON intermédiaire
  const outPath = path.resolve('data', `pv-${parsed.seance.date}.json`)
  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(outPath, JSON.stringify(parsed, null, 2))
  console.log(`\n💾 JSON sauvegardé : ${outPath}`)

  console.log(`\n📊 Résumé :`)
  console.log(`   Séance : ${parsed.seance.date} à ${parsed.seance.heure}`)
  console.log(`   Conseillers : ${parsed.conseillers.length}`)
  console.log(`   Délibérations : ${parsed.deliberations.length}`)
  const withDebats = parsed.deliberations.filter(d => d.debats?.length)
  console.log(`   Dont avec débats : ${withDebats.length}`)
  const withVoteDetail = parsed.deliberations.filter(d => d.vote.type === 'majorite')
  console.log(`   Dont avec vote détaillé : ${withVoteDetail.length}`)
}

// Exécuter main() uniquement si appelé directement (pas importé)
const isDirectRun = process.argv[1]?.includes('parse-pv')
if (isDirectRun) {
  main().catch(err => {
    console.error('❌ Erreur:', err.message)
    process.exit(1)
  })
}

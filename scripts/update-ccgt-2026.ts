/**
 * Mise à jour du conseil communautaire CCGT — Mandat 2026
 * Source : PV d'élection du 07/04/2026 (ccgascognetoulousaine.com)
 */

import { login, getItems, createItem, updateItem } from './lib/directus'

const CCGT_ID = 2
const DATE_MANDAT = '2026-04-07'

// Communes CCGT → id (créées à la volée si manquantes)
const COMMUNES: Record<string, number | null> = {
  "L'ISLE-JOURDAIN": 1,
  "AURADÉ": 4,
  "BEAUPUY": 5,
  "CLERMONT-SAVÈS": 6,
  "ENDOUFIELLE": 7,
  "LIAS": 9,
  "MONFERRAN-SAVÈS": 10,
  "PUJAUDRAN": 11,
  "RAZENGUES": 12,
  "SÉGOUFIELLE": 13,
  "CASTILLON-SAVÈS": null, // à créer
  "FRÉGOUVILLE": null,
  "MARESTAING": null,
}

type Role = 'president' | 'vice_president' | 'conseiller_communautaire'

interface EluCC {
  nom: string
  prenom: string
  commune: string
  role: Role
  ordreVP?: number
  absent?: boolean
}

const CONSEIL_CCGT: EluCC[] = [
  // Président
  { nom: 'BIZARD', prenom: 'Éric', commune: "L'ISLE-JOURDAIN", role: 'president' },
  // Vice-présidents (ordre du PV)
  { nom: 'ABADIE', prenom: 'Muriel', commune: 'PUJAUDRAN', role: 'vice_president', ordreVP: 1 },
  { nom: 'TAICLET', prenom: 'Benoît', commune: 'RAZENGUES', role: 'vice_president', ordreVP: 2 },
  { nom: 'DANEZAN', prenom: 'Claudine', commune: 'MARESTAING', role: 'vice_president', ordreVP: 3 },
  { nom: 'BEYRIES', prenom: 'Gérôme', commune: 'MONFERRAN-SAVÈS', role: 'vice_president', ordreVP: 4 },
  { nom: 'DARDENNE', prenom: 'Joëlle', commune: 'SÉGOUFIELLE', role: 'vice_president', ordreVP: 5 },
  { nom: 'DELIX', prenom: 'Julien', commune: 'CASTILLON-SAVÈS', role: 'vice_president', ordreVP: 6 },
  { nom: 'PAQUIN', prenom: 'Frédéric', commune: 'BEAUPUY', role: 'vice_president', ordreVP: 7 },
  { nom: 'CAPDEVILLE', prenom: 'Philippe', commune: 'CLERMONT-SAVÈS', role: 'vice_president', ordreVP: 8 },
  { nom: 'DALDOSSO', prenom: 'Michel', commune: 'FRÉGOUVILLE', role: 'vice_president', ordreVP: 9 },
  { nom: 'SERVAT', prenom: 'Jean-Claude', commune: 'AURADÉ', role: 'vice_president', ordreVP: 10 },
  { nom: 'NINARD', prenom: 'Yannick', commune: "L'ISLE-JOURDAIN", role: 'vice_president', ordreVP: 11 },
  // Conseillers communautaires (présents)
  { nom: 'ALAUX', prenom: 'Marie', commune: 'LIAS', role: 'conseiller_communautaire' },
  { nom: 'ALLALI', prenom: 'Kamel', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'AUVRAY', prenom: 'Delphine', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'BINAS', prenom: 'Fanny', commune: 'SÉGOUFIELLE', role: 'conseiller_communautaire' },
  { nom: 'BOBIER', prenom: 'Corinne', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'BRISARD', prenom: 'Rémy', commune: 'PUJAUDRAN', role: 'conseiller_communautaire' },
  { nom: 'COHEN', prenom: 'Géraldine', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'DAVEZAC', prenom: 'Éloïse', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'DINCLAUX', prenom: 'Bérengère', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'DUCAUZE', prenom: 'Gabin', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'HENNEBELLE', prenom: 'Christophe', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'HIEU', prenom: 'Thibaut', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'IDRAC', prenom: 'Francis', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'LAPORTE', prenom: 'François', commune: 'LIAS', role: 'conseiller_communautaire' },
  { nom: 'LEBRERE', prenom: 'Séverine', commune: 'ENDOUFIELLE', role: 'conseiller_communautaire' },
  { nom: 'LOUBENS', prenom: 'Pierre', commune: 'AURADÉ', role: 'conseiller_communautaire' },
  { nom: 'MARIOTTI', prenom: 'Pierre', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'MARTELOZZO', prenom: 'Martine', commune: 'PUJAUDRAN', role: 'conseiller_communautaire' },
  { nom: 'MEY', prenom: 'Fabrice', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'PETRUS', prenom: 'Denis', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'PROST', prenom: 'Stéphanie', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire' },
  { nom: 'ROUBERT', prenom: 'Patricia', commune: 'MONFERRAN-SAVÈS', role: 'conseiller_communautaire' },
  // Absents excusés du 07/04 (membres élus)
  { nom: 'DASSIEU', prenom: 'Daniel', commune: 'PUJAUDRAN', role: 'conseiller_communautaire', absent: true },
  { nom: 'FURLAN', prenom: 'Vanessa', commune: "L'ISLE-JOURDAIN", role: 'conseiller_communautaire', absent: true },
  { nom: 'VERGÉ', prenom: 'Frédéric', commune: 'SÉGOUFIELLE', role: 'conseiller_communautaire', absent: true },
]

function normalizeNom(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ').toLowerCase().trim()
}

async function ensureCommune(nom: string): Promise<number> {
  const existing = COMMUNES[nom.toUpperCase()]
  if (existing) return existing
  // Créer la commune
  const normalized = nom.charAt(0).toUpperCase() + nom.slice(1).toLowerCase()
    .replace(/-([a-z])/g, (_, c) => '-' + c.toUpperCase())
    .replace(/è/g, 'è').replace(/é/g, 'é')
  const created = await createItem('collectivites', { nom: normalized, type: 'commune' })
  console.log(`  🏘  Commune créée : ${normalized} (id=${created.id})`)
  COMMUNES[nom.toUpperCase()] = created.id
  return created.id
}

async function main() {
  console.log("🏛  Mise à jour conseil communautaire CCGT — Mandat 2026\n")
  await login()

  // 1. Créer les communes manquantes
  for (const nomCommune of Object.keys(COMMUNES)) {
    if (COMMUNES[nomCommune] === null) {
      const nomPropre = nomCommune === 'CASTILLON-SAVÈS' ? 'Castillon-Savès'
        : nomCommune === 'FRÉGOUVILLE' ? 'Frégouville'
        : nomCommune === 'MARESTAING' ? 'Marestaing'
        : nomCommune
      await ensureCommune(nomPropre)
    }
  }

  // 2. Charger les élus existants
  const existingElus = await getItems('elus', 'limit=500')
  const elusByKey = new Map<string, any>()
  for (const e of existingElus) {
    elusByKey.set(`${normalizeNom(e.prenom)}|${normalizeNom(e.nom)}`, e)
  }
  console.log(`\n📋 ${existingElus.length} élus en base\n`)

  // 3. Mettre à jour / créer les élus CCGT
  let updated = 0, created = 0
  for (const elu of CONSEIL_CCGT) {
    const key = `${normalizeNom(elu.prenom)}|${normalizeNom(elu.nom)}`
    const existing = elusByKey.get(key)

    const communeId = COMMUNES[elu.commune]
    const communeLabel = elu.commune === 'CASTILLON-SAVÈS' ? 'Castillon-Savès'
      : elu.commune === 'FRÉGOUVILLE' ? 'Frégouville'
      : elu.commune === 'MARESTAING' ? 'Marestaing'
      : elu.commune.charAt(0) + elu.commune.slice(1).toLowerCase()

    const mandatCCGT: any = {
      collectivite: CCGT_ID,
      role: elu.role,
      commune: communeLabel,
      date_debut: DATE_MANDAT,
      date_fonction: DATE_MANDAT,
    }
    if (elu.ordreVP) mandatCCGT.ordreAdjoint = elu.ordreVP

    if (existing) {
      // Retirer l'ancien mandat CCGT s'il existe + ajouter le nouveau
      const mandats = (existing.mandats || []).filter((m: any) => m.collectivite !== CCGT_ID)
      mandats.push(mandatCCGT)
      await updateItem('elus', existing.id, { mandats })
      const roleStr = elu.role === 'president' ? 'Président' : elu.role === 'vice_president' ? `${elu.ordreVP}e VP` : 'Conseiller'
      console.log(`  ✏️  ${elu.prenom} ${elu.nom} (${communeLabel}) — ${roleStr}${elu.absent ? ' [absent 07/04]' : ''}`)
      updated++
    } else {
      const payload: any = {
        nom: elu.nom,
        prenom: elu.prenom,
        mandats: [mandatCCGT],
      }
      await createItem('elus', payload)
      const roleStr = elu.role === 'president' ? 'Président' : elu.role === 'vice_president' ? `${elu.ordreVP}e VP` : 'Conseiller'
      console.log(`  ➕ ${elu.prenom} ${elu.nom} (${communeLabel}) — ${roleStr} [NOUVEAU]`)
      created++
    }
  }

  // 4. Retirer le mandat CCGT des anciens conseillers qui n'y sont plus
  const nouveauxKeys = new Set(CONSEIL_CCGT.map(e => `${normalizeNom(e.prenom)}|${normalizeNom(e.nom)}`))
  let removed = 0
  for (const existing of existingElus) {
    const key = `${normalizeNom(existing.prenom)}|${normalizeNom(existing.nom)}`
    if (nouveauxKeys.has(key)) continue

    const mandats = existing.mandats || []
    const hadCCGT = mandats.some((m: any) => m.collectivite === CCGT_ID)
    if (!hadCCGT) continue

    const newMandats = mandats.filter((m: any) => m.collectivite !== CCGT_ID)
    await updateItem('elus', existing.id, { mandats: newMandats })
    console.log(`  ❌ ${existing.prenom} ${existing.nom} — retiré du conseil CCGT`)
    removed++
  }

  console.log(`\n📊 Bilan : ${updated} mis à jour, ${created} créés, ${removed} retirés`)
  console.log(`\n✅ Conseil CCGT 2026 importé — Président : Éric BIZARD (L'Isle-Jourdain)`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

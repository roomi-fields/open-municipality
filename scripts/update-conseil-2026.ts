/**
 * Mise à jour du conseil municipal de L'Isle-Jourdain — Mandat 2026
 * Source : site mairie-islejourdain.fr/equipe-municipale (scraped 2026-04-08)
 *
 * + Import des engagements de campagne de l'équipe Bizard
 * Source : /mnt/d/Claude/municipales/adversaires/02-BIZARD-Eric-Demain-Ensemble.md
 */

import { login, api, getItems, createItem, updateItem } from './lib/directus'

const COLLECTIVITE_LIJ = 1 // L'Isle-Jourdain

// Nouveau conseil municipal 2026 — source: mairie-islejourdain.fr
const NOUVEAU_CONSEIL = [
  // Maire
  { nom: 'BIZARD', prenom: 'Eric', role: 'maire', delegations: '' },
  // Adjoints
  { nom: 'DAVEZAC', prenom: 'Eloïse', role: 'adjoint', ordreAdjoint: 1, delegations: 'Éducation et Jeunesse' },
  { nom: 'PETRUS', prenom: 'Denis', role: 'adjoint', ordreAdjoint: 2, delegations: 'Environnement, Commerce, Marché, Tourisme' },
  { nom: 'PROST', prenom: 'Stéphanie', role: 'adjoint', ordreAdjoint: 3, delegations: 'Action Sociale, Santé, Solidarité' },
  { nom: 'MARIOTTI', prenom: 'Pierre', role: 'adjoint', ordreAdjoint: 4, delegations: 'Finances, Démocratie Participative' },
  { nom: 'AUVRAY', prenom: 'Delphine', role: 'adjoint', ordreAdjoint: 5, delegations: 'Urbanisme' },
  { nom: 'HENNEBELLE', prenom: 'Christophe', role: 'adjoint', ordreAdjoint: 6, delegations: 'Travaux, Sécurité, Commémorations' },
  { nom: 'BOBIER', prenom: 'Corinne', role: 'adjoint', ordreAdjoint: 7, delegations: 'Culture' },
  // Conseillers avec délégations
  { nom: 'MINVIELLE', prenom: 'Daniel', role: 'conseiller', delegations: 'Cimetière, Services funéraires, Vie de quartier' },
  { nom: 'DA CANAL', prenom: 'Jacques', role: 'conseiller', delegations: '' },
  { nom: 'MARCHAL', prenom: 'Frédéric', role: 'conseiller', delegations: 'Communication, Numérique' },
  { nom: 'TRABAUD', prenom: 'Jean-Michel', role: 'conseiller', delegations: '' },
  { nom: 'ARGELA', prenom: 'Vivian', role: 'conseiller', delegations: 'Bien-être animal' },
  { nom: 'MEY', prenom: 'Fabrice', role: 'conseiller', delegations: 'Sports' },
  { nom: 'COHEN', prenom: 'Géraldine', role: 'conseiller', delegations: 'Eau, Assainissement' },
  { nom: 'FURLAN', prenom: 'Vanessa', role: 'conseiller', delegations: 'Ressources Humaines' },
  { nom: 'MARIETTE', prenom: 'Estelle', role: 'conseiller', delegations: '' },
  { nom: 'ALLALI', prenom: 'Kamel', role: 'conseiller', delegations: 'Cadre de vie' },
  { nom: 'GATTEAUX', prenom: 'Hélène', role: 'conseiller', delegations: 'Transition écologique' },
  { nom: 'DINCLAUX', prenom: 'Bérengère', role: 'conseiller', delegations: 'Événementiel, Culture occitane' },
  { nom: 'TRIQUET', prenom: 'Audrey', role: 'conseiller', delegations: '' },
  { nom: 'MAKSIMTCHOUK', prenom: 'Alona', role: 'conseiller', delegations: 'Nouveaux arrivants, Épicerie sociale' },
  { nom: 'HIEU', prenom: 'Thibaut', role: 'conseiller', delegations: 'Vie associative' },
  // Opposition
  { nom: 'NINARD', prenom: 'Yannick', role: 'conseiller', delegations: '' },
  { nom: 'BIGNEBAT', prenom: 'Jacques', role: 'conseiller', delegations: '' },
  { nom: 'LARRUE BOIZIOT', prenom: 'Géraldine', role: 'conseiller', delegations: '' },
  { nom: 'IDRAC', prenom: 'Francis', role: 'conseiller', delegations: '' },
  { nom: 'DIRAT', prenom: 'Brigitte', role: 'conseiller', delegations: '' },
  { nom: 'DUCAUZE', prenom: 'Gabin', role: 'conseiller', delegations: '' },
]

// Engagements de campagne — source: programme Demain Ensemble (23 pages)
const ENGAGEMENTS = [
  // Les 20 priorités
  { description: 'Labellisation « Ville amie des enfants » (UNICEF)', theme: 'education', priorite: true },
  { description: 'Construction d\'un nouvel EHPAD', theme: 'social', priorite: true },
  { description: 'Complémentaire santé communale (mutuelle municipale)', theme: 'social', priorite: true },
  { description: 'Ferme maraîchère municipale couvrant 40% des besoins de la cuisine centrale', theme: 'environnement', priorite: true },
  { description: 'Gestion publique de l\'eau : améliorer qualité, protéger captage, réduire fuites', theme: 'environnement', priorite: true },
  { description: 'Budget participatif', theme: 'democratie', priorite: true },
  { description: 'Gratuité transports urbains et Transport à la Demande (TAD)', theme: 'transport', priorite: true },
  { description: 'Baisse de la taxe foncière', theme: 'finances', priorite: true },
  { description: 'Audit financier indépendant avec restitution publique', theme: 'finances', priorite: true },
  { description: 'Vidéo-protection ciblée aux points sensibles', theme: 'securite', priorite: true },
  { description: 'Éclairage public 100% LED + détecteurs de présence', theme: 'environnement', priorite: true },
  { description: 'Résidence autonomie intergénérationnelle', theme: 'social', priorite: true },
  { description: 'Zones 30 et sécurisation des voiries', theme: 'transport', priorite: true },
  { description: 'Gare intermodale SERM (Service Express Régional Métropolitain)', theme: 'transport', priorite: true },
  { description: 'Manager de commerce centre-ville', theme: 'economie', priorite: true },
  { description: 'Plan touristique (Musée Campanaire, lac, patrimoine)', theme: 'economie', priorite: true },
  { description: 'Application citoyenne unique : signalements, suivi, actualité, alertes', theme: 'democratie', priorite: true },
  { description: 'Étude de faisabilité salle multi-culturelle et associative (avec CCGT)', theme: 'culture', priorite: true },
  { description: 'Nouvelle déchèterie intercommunale', theme: 'environnement', priorite: true },
  { description: 'Charte éthique et transparence (conflits d\'intérêts, avantages > 150€, SCI)', theme: 'democratie', priorite: true },
  // Engagements supplémentaires par thème
  { description: 'Conseil municipal des jeunes lycéens', theme: 'education' },
  { description: 'Prévention du décrochage scolaire', theme: 'education' },
  { description: 'Amélioration de l\'accès aux crèches', theme: 'education' },
  { description: 'Livraison de repas à domicile pour les seniors', theme: 'social' },
  { description: 'Coulée verte continue : berges de la Save, lac, centre-ville via pont Tourné', theme: 'urbanisme' },
  { description: 'Maîtriser lotissements et étalement urbain', theme: 'urbanisme' },
  { description: 'Redynamiser le cœur historique : réhabiliter logements vacants, valoriser patrimoine', theme: 'urbanisme' },
  { description: 'Plan ambitieux de rénovation des voiries', theme: 'urbanisme' },
  { description: 'Végétalisation espaces publics, îlots de fraîcheur', theme: 'environnement' },
  { description: 'Pistes cyclables continues', theme: 'transport' },
  { description: 'Plan Pluriannuel d\'Investissements priorisé', theme: 'finances' },
  { description: 'Tableau de bord financier accessible en ligne', theme: 'finances' },
  { description: 'Programmation culturelle annuelle co-construite avec acteurs locaux', theme: 'culture' },
  { description: 'Conseil de la culture (habitants associés)', theme: 'culture' },
  { description: 'Concertation citoyenne sur le musée campanaire', theme: 'culture' },
  { description: 'Simplifier démarches administratives associations', theme: 'democratie' },
  { description: 'Moderniser le site Internet de la mairie', theme: 'democratie' },
  { description: 'Démarches administratives en ligne', theme: 'democratie' },
  { description: 'Réunions publiques régulières de concertation citoyenne', theme: 'democratie' },
  { description: 'Police municipale : présence humaine renforcée', theme: 'securite' },
  { description: 'Sécurisation des entrées de ville (avec Département)', theme: 'transport' },
]

function normalizeNom(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/-/g, ' ').toLowerCase().trim()
}

async function main() {
  console.log('🏛  Mise à jour conseil municipal L\'Isle-Jourdain — Mandat 2026\n')
  await login()

  // 1. Charger les élus existants
  const existingElus = await getItems('elus', 'limit=500')
  const elusByKey = new Map<string, any>()
  for (const e of existingElus) {
    elusByKey.set(`${normalizeNom(e.prenom)}|${normalizeNom(e.nom)}`, e)
  }
  console.log(`📋 ${existingElus.length} élus en base\n`)

  // 2. Mettre à jour / créer les élus du nouveau conseil
  let updated = 0, created = 0
  const DATE_MANDAT = '2026-03-23' // date investiture probable

  for (const elu of NOUVEAU_CONSEIL) {
    const key = `${normalizeNom(elu.prenom)}|${normalizeNom(elu.nom)}`
    const existing = elusByKey.get(key)

    const mandat: any = {
      collectivite: COLLECTIVITE_LIJ,
      role: elu.role,
      commune: "L'Isle-Jourdain",
      date_debut: DATE_MANDAT,
      date_fonction: DATE_MANDAT,
    }
    if (elu.ordreAdjoint) mandat.ordreAdjoint = elu.ordreAdjoint

    if (existing) {
      // Remplacer le mandat L'Isle-Jourdain existant par le nouveau
      const mandats = (existing.mandats || []).filter((m: any) => m.collectivite !== COLLECTIVITE_LIJ)
      mandats.unshift(mandat) // nouveau mandat en premier

      const payload: any = {
        mandats,
        liste_electorale: 'Demain Ensemble',
        date_debut_mandat: DATE_MANDAT,
      }
      if (elu.delegations) payload.delegations = elu.delegations

      await updateItem('elus', existing.id, payload)
      console.log(`  ✏️  ${elu.prenom} ${elu.nom} — ${elu.role}${elu.delegations ? ' (' + elu.delegations + ')' : ''}`)
      updated++
    } else {
      // Nouvel élu
      const payload: any = {
        nom: elu.nom,
        prenom: elu.prenom,
        mandats: [mandat],
        liste_electorale: 'Demain Ensemble',
        date_debut_mandat: DATE_MANDAT,
      }
      if (elu.delegations) payload.delegations = elu.delegations

      await createItem('elus', payload)
      console.log(`  ➕ ${elu.prenom} ${elu.nom} — ${elu.role}${elu.delegations ? ' (' + elu.delegations + ')' : ''} [NOUVEAU]`)
      created++
    }
  }

  // 3. Marquer les anciens élus qui ne sont plus au conseil
  const nouveauxKeys = new Set(NOUVEAU_CONSEIL.map(e => `${normalizeNom(e.prenom)}|${normalizeNom(e.nom)}`))
  let removed = 0
  for (const existing of existingElus) {
    const key = `${normalizeNom(existing.prenom)}|${normalizeNom(existing.nom)}`
    if (nouveauxKeys.has(key)) continue

    const mandats = existing.mandats || []
    const hadLIJ = mandats.some((m: any) => m.collectivite === COLLECTIVITE_LIJ)
    if (!hadLIJ) continue

    // Retirer le mandat LIJ (l'élu peut garder ses autres mandats)
    const newMandats = mandats.filter((m: any) => m.collectivite !== COLLECTIVITE_LIJ)
    await updateItem('elus', existing.id, { mandats: newMandats })
    console.log(`  ❌ ${existing.prenom} ${existing.nom} — plus au conseil de L'Isle-Jourdain`)
    removed++
  }

  console.log(`\n📊 Bilan élus : ${updated} mis à jour, ${created} créés, ${removed} retirés du conseil`)

  // 4. Importer les engagements de campagne
  console.log('\n📝 Import des engagements de campagne — Demain Ensemble\n')

  // Charger les thèmes
  const themes = await getItems('themes', 'limit=50')
  const themeMap = new Map<string, number>()
  for (const t of themes) {
    const nom = normalizeNom(t.nom)
    themeMap.set(nom, t.id)
  }
  console.log(`   Thèmes disponibles: ${[...themeMap.keys()].join(', ')}`)

  // Mapping thème engagement → thème Directus
  const THEME_MAPPING: Record<string, string> = {
    education: 'education',
    social: 'social',
    environnement: 'environnement',
    democratie: 'democratie',
    transport: 'transport',
    finances: 'finances',
    securite: 'securite',
    economie: 'economie',
    culture: 'culture',
    urbanisme: 'urbanisme',
  }

  // Supprimer les anciens engagements (un par un, batch delete non supporté)
  const oldEngagements = await getItems('engagements', 'limit=200')
  if (oldEngagements.length > 0) {
    for (const eng of oldEngagements) {
      try { await api('DELETE', `/items/engagements/${eng.id}`) } catch {}
    }
    console.log(`   🗑  ${oldEngagements.length} anciens engagements supprimés`)
  }

  // Créer les nouveaux
  let engCreated = 0
  for (const eng of ENGAGEMENTS) {
    const themeKey = THEME_MAPPING[eng.theme]
    const themeId = themeKey ? themeMap.get(themeKey) : undefined

    await createItem('engagements', {
      description: eng.description,
      liste_electorale: 'Demain Ensemble',
      theme: themeId || null,
      statut: 'pas_commence',
      source: 'Programme de campagne 2026 — 23 pages',
    })
    engCreated++
  }

  console.log(`   ✅ ${engCreated} engagements importés (dont ${ENGAGEMENTS.filter(e => e.priorite).length} priorités)`)
  console.log('\n✅ Mise à jour terminée !')
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

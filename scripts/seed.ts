/**
 * Seed Directus avec les données de base de la plateforme citoyenne.
 * Usage : npx tsx seed.ts
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
let TOKEN = ''

async function login() {
  const resp = await fetch(`${DIRECTUS_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@plateforme-citoyenne.fr', password: 'admin' }),
  })
  const data = await resp.json()
  TOKEN = data.data.access_token
}

async function api(method: string, endpoint: string, body?: any) {
  const opts: RequestInit = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${TOKEN}` },
  }
  if (body) opts.body = JSON.stringify(body)
  const resp = await fetch(`${DIRECTUS_URL}${endpoint}`, opts)
  return resp.json()
}

async function upsert(collection: string, filter: string, data: any): Promise<number> {
  const existing = await api('GET', `/items/${collection}?filter${filter}&limit=1`)
  if (existing.data?.length > 0) return existing.data[0].id
  const created = await api('POST', `/items/${collection}`, data)
  return created.data?.id
}

async function main() {
  console.log('🌱 Seed Directus — Plateforme Citoyenne\n')
  await login()

  // ── Collectivités ──
  console.log('🏛  Collectivités...')
  const lij = await upsert('collectivites', '[code_insee][_eq]=32160', {
    nom: "L'Isle-Jourdain", type: 'commune', code_insee: '32160', population: 8500, departement: 'Gers (32)',
    site_web: 'https://www.mairie-islejourdain.fr',
  })
  const ccgt = await upsert('collectivites', '[nom][_contains]=Gascogne', {
    nom: 'CC Gascogne Toulousaine', type: 'interco', population: 22300,
    site_web: 'https://www.ccgascognetoulousaine.com',
  })
  const canton = await upsert('collectivites', '[type][_eq]=canton', {
    nom: "Canton de L'Isle-Jourdain", type: 'canton', departement: 'Gers (32)',
  })
  // Liens hiérarchiques
  await api('PATCH', `/items/collectivites/${lij}`, { parent_interco: ccgt, parent_canton: canton })

  // Autres communes du canton
  const communes = [
    { nom: 'Auradé', code_insee: '32016', population: 700 },
    { nom: 'Beaupuy', code_insee: '32038', population: 450 },
    { nom: 'Clermont-Savès', code_insee: '32105', population: 350 },
    { nom: 'Endoufielle', code_insee: '32121', population: 500 },
    { nom: 'Fontenilles', code_insee: '32134', population: 4500 },
    { nom: 'Lias', code_insee: '32210', population: 2200 },
    { nom: 'Monferran-Savès', code_insee: '32268', population: 1800 },
    { nom: 'Pujaudran', code_insee: '32334', population: 1600 },
    { nom: 'Razengues', code_insee: '32339', population: 200 },
    { nom: 'Ségoufielle', code_insee: '32425', population: 1200 },
  ]
  for (const c of communes) {
    const id = await upsert('collectivites', `[code_insee][_eq]=${c.code_insee}`, {
      ...c, type: 'commune', departement: 'Gers (32)', parent_interco: ccgt, parent_canton: canton,
    })
  }
  console.log(`   ✓ ${communes.length + 3} collectivités`)

  // ── Thèmes ──
  console.log('\n🏷  Thèmes...')
  const themes = [
    { nom: 'Finances', slug: 'finances', icone: '💰' },
    { nom: 'Urbanisme', slug: 'urbanisme', icone: '🏗️' },
    { nom: 'Éducation & Cantines', slug: 'education', icone: '🎓' },
    { nom: 'Environnement', slug: 'environnement', icone: '🌿' },
    { nom: 'Eau & Assainissement', slug: 'eau', icone: '💧' },
    { nom: 'Sport & Loisirs', slug: 'sport', icone: '⚽' },
    { nom: 'Culture', slug: 'culture', icone: '🎭' },
    { nom: 'Social & Solidarité', slug: 'social', icone: '🤝' },
    { nom: 'Tourisme', slug: 'tourisme', icone: '🏕️' },
    { nom: 'Funéraire', slug: 'funeraire', icone: '🕊️' },
    { nom: 'Transport & Voirie', slug: 'transport', icone: '🚗' },
    { nom: 'Énergie', slug: 'energie', icone: '⚡' },
    { nom: 'Administration', slug: 'administration', icone: '📋' },
  ]
  for (const t of themes) {
    await upsert('themes', `[slug][_eq]=${t.slug}`, t)
  }
  console.log(`   ✓ ${themes.length} thèmes`)

  // ── Séance de démo ──
  console.log('\n📅 Séance de démo...')
  const seanceId = await upsert('seances', '[date][_eq]=2025-12-16', {
    date: '2025-12-16', type: 'conseil_municipal', collectivite: lij, lieu: "Mairie de L'Isle-Jourdain", statut: 'passee',
  })

  // ── Délibérations de démo ──
  console.log('\n📄 Délibérations de démo...')
  const themeCache: Record<string, number> = {}
  for (const t of themes) {
    const resp = await api('GET', `/items/themes?filter[slug][_eq]=${t.slug}&limit=1`)
    if (resp.data?.length) themeCache[t.slug] = resp.data[0].id
  }

  const deliberations = [
    { numero: '2025-001', titre: 'COMPTE RENDU DES DECISIONS PRISES PAR DELEGATION', resume: "Présentation des décisions prises par le maire entre les deux séances. Concerne notamment l'attribution de marchés de maintenance et des conventions avec des associations.", theme: 'administration' },
    { numero: '2025-002', titre: 'BUDGET PRINCIPAL - DECISION MODIFICATIVE N°3', resume: "Ajustement budgétaire de fin d'année : transfert de crédits entre chapitres pour couvrir des dépenses imprévues en voirie et bâtiments communaux.", theme: 'finances', montant: 85000 },
    { numero: '2025-003', titre: 'RESTAURATION SCOLAIRE - TARIFS 2026', resume: "Vote des nouveaux tarifs de cantine pour 2026. Augmentation de 3% pour suivre l'inflation alimentaire. Maintien du tarif réduit pour les familles modestes.", theme: 'education', montant: 2.85 },
    { numero: '2025-004', titre: "CONVENTION AVEC L'ASSOCIATION SPORTIVE LISLOISE", resume: "Renouvellement de la convention triennale avec l'ASL pour l'utilisation des équipements sportifs municipaux. Subvention de 15 000€.", theme: 'sport', montant: 15000 },
    { numero: '2025-005', titre: 'PLU - MODIFICATION SIMPLIFIEE N°2', resume: "Modification du Plan Local d'Urbanisme pour permettre la construction de logements sociaux dans le quartier de la gare. Passage de zone AU en zone U.", theme: 'urbanisme' },
    { numero: '2025-006', titre: 'EMPRUNT POUR RENOVATION DE LA PISCINE MUNICIPALE', resume: "Autorisation d'emprunt de 1,2M€ pour la rénovation énergétique de la piscine. Installation de panneaux solaires et isolation du bassin.", theme: 'sport', montant: 1200000 },
    { numero: '2025-007', titre: "STATION D'EPURATION - MISE AUX NORMES", resume: "Lancement des travaux de mise aux normes de la station d'épuration. Budget de 800 000€ financé à 60% par l'Agence de l'eau.", theme: 'eau', montant: 800000 },
    { numero: '2025-008', titre: 'QUESTIONS DIVERSES', resume: "Points d'information sur le marché de Noël, les travaux du pont de la Save et le calendrier des prochaines séances.", theme: 'administration' },
  ]

  for (const d of deliberations) {
    await upsert('deliberations', `[numero][_eq]=${d.numero}`, {
      numero: d.numero,
      titre: d.titre,
      resume_ia: d.resume,
      seance: seanceId,
      theme: themeCache[d.theme],
      vote_pour: 25 + Math.floor(Math.random() * 4),
      vote_contre: Math.floor(Math.random() * 3),
      vote_abstention: Math.floor(Math.random() * 2),
      budget_montant: d.montant || null,
      statut: 'publie',
    })
  }
  console.log(`   ✓ ${deliberations.length} délibérations`)

  // ── Signalements de démo ──
  console.log('\n⚠️  Signalements de démo...')
  const signalements = [
    { titre: 'Nid de poule dangereux rue de la Gare', type: 'voirie', statut: 'en_cours', latitude: 43.6147, longitude: 1.0824, adresse: 'Rue de la Gare' },
    { titre: 'Lampadaire éteint place de la Mairie', type: 'eclairage', statut: 'signale', latitude: 43.6133, longitude: 1.0812, adresse: 'Place de la Mairie' },
    { titre: 'Dépôt sauvage chemin des Vignes', type: 'proprete', statut: 'transmis', latitude: 43.6180, longitude: 1.0790, adresse: 'Chemin des Vignes' },
    { titre: 'Banc cassé au parc municipal', type: 'voirie', statut: 'resolu', latitude: 43.6140, longitude: 1.0835, adresse: 'Parc municipal', reponse: 'Le banc a été remplacé le 15 janvier 2026.' },
  ]
  for (const s of signalements) {
    await upsert('signalements', `[titre][_eq]=${encodeURIComponent(s.titre)}`, { ...s, description: s.titre })
  }
  console.log(`   ✓ ${signalements.length} signalements`)

  // ── Pétitions de démo ──
  console.log('\n✍️  Pétitions de démo...')
  const petitions = [
    { titre: 'Piste cyclable vers Fontenilles', description: 'Demande de création d\'une piste cyclable sécurisée reliant L\'Isle-Jourdain à Fontenilles le long de la D634.', theme: themeCache['transport'], nombre_signatures: 67, seuil: 100, statut: 'ouverte' },
    { titre: 'Ouverture dominicale de la médiathèque', description: 'Proposition d\'ouvrir la médiathèque municipale le dimanche matin pour les familles.', theme: themeCache['culture'], nombre_signatures: 103, seuil: 100, statut: 'seuil_atteint' },
  ]
  for (const p of petitions) {
    await upsert('petitions', `[titre][_eq]=${encodeURIComponent(p.titre)}`, p)
  }
  console.log(`   ✓ ${petitions.length} pétitions`)

  // ── Engagements de démo ──
  console.log('\n📋 Engagements de démo...')
  const engagements = [
    { description: 'Créer une maison des associations', liste_electorale: 'Vivre à L\'Isle-Jourdain', statut: 'en_cours', theme: themeCache['social'] },
    { description: 'Rénover la piscine municipale', liste_electorale: 'Vivre à L\'Isle-Jourdain', statut: 'en_cours', theme: themeCache['sport'] },
    { description: 'Installer 50 bornes de recharge électrique', liste_electorale: 'Vivre à L\'Isle-Jourdain', statut: 'pas_commence', theme: themeCache['transport'] },
    { description: 'Végétaliser le centre-ville', liste_electorale: 'Vivre à L\'Isle-Jourdain', statut: 'realise', theme: themeCache['environnement'] },
  ]
  for (const e of engagements) {
    await upsert('engagements', `[description][_eq]=${encodeURIComponent(e.description.substring(0, 30))}`, e)
  }
  console.log(`   ✓ ${engagements.length} engagements`)

  console.log('\n✅ Seed terminé !')
  console.log(`\n🌐 Admin : ${DIRECTUS_URL}/admin`)
  console.log(`📡 API publique : ${DIRECTUS_URL}/items/deliberations`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

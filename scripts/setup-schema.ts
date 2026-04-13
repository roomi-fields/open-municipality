/**
 * Crée le schéma complet de la plateforme citoyenne dans Directus.
 * Usage : npx tsx scripts/setup-schema.ts
 */

const DIRECTUS_URL = process.env.DIRECTUS_URL || 'http://localhost:8055'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'directus-admin-token-dev'

async function api(method: string, endpoint: string, body?: any) {
  const opts: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_TOKEN}`,
    },
  }
  if (body) opts.body = JSON.stringify(body)
  const resp = await fetch(`${DIRECTUS_URL}${endpoint}`, opts)
  const data = await resp.json()
  if (!resp.ok) {
    // Ignore "already exists" errors
    if (data?.errors?.[0]?.extensions?.code === 'RECORD_NOT_UNIQUE' ||
        data?.errors?.[0]?.message?.includes('already exists')) {
      return data
    }
    console.error(`  ✗ ${method} ${endpoint}:`, JSON.stringify(data.errors || data).substring(0, 200))
  }
  return data
}

// ── Helpers ──────────────────────────────────────────────────

async function createCollection(collection: string, fields: any[], meta?: any) {
  console.log(`📦 Collection: ${collection}`)
  const resp = await api('POST', '/collections', {
    collection,
    schema: {},  // Crée la table SQL
    meta: { icon: meta?.icon || 'box', note: meta?.note || '', ...(meta || {}) },
    fields: [
      { field: 'id', type: 'integer', meta: { hidden: true, interface: 'input', readonly: true }, schema: { is_primary_key: true, has_auto_increment: true } },
      ...fields,
    ],
  })
  if (resp?.data) console.log(`   ✓ Créée`)
  else console.log(`   ⏭ Existe déjà ou erreur`)
}

async function createField(collection: string, field: any) {
  await api('POST', `/fields/${collection}`, field)
}

// ── Collections ──────────────────────────────────────────────

async function main() {
  console.log('🏛  Setup schéma Directus — Plateforme Citoyenne\n')

  // ── Collectivités ──
  await createCollection('collectivites', [
    { field: 'nom', type: 'string', meta: { interface: 'input', required: true, width: 'half' }, schema: {} },
    { field: 'type', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Commune', value: 'commune' }, { text: 'Intercommunalité', value: 'interco' },
      { text: 'Canton', value: 'canton' }, { text: 'Département', value: 'departement' },
    ] }, required: true, width: 'half' }, schema: {} },
    { field: 'code_insee', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'population', type: 'integer', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'departement', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'site_web', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
  ], { icon: 'location_city', note: 'Communes, intercommunalités, cantons' })

  // Relations hiérarchiques collectivités
  await createField('collectivites', {
    field: 'parent_interco', type: 'integer',
    meta: { interface: 'select-dropdown-m2o', special: ['m2o'] },
    schema: { foreign_key_table: 'collectivites', foreign_key_column: 'id' },
  })
  await createField('collectivites', {
    field: 'parent_canton', type: 'integer',
    meta: { interface: 'select-dropdown-m2o', special: ['m2o'] },
    schema: { foreign_key_table: 'collectivites', foreign_key_column: 'id' },
  })

  // ── Thèmes ──
  await createCollection('themes', [
    { field: 'nom', type: 'string', meta: { interface: 'input', required: true, width: 'half' }, schema: {} },
    { field: 'slug', type: 'string', meta: { interface: 'input', required: true, width: 'half' }, schema: { is_unique: true } },
    { field: 'icone', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'couleur', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
  ], { icon: 'label', note: 'Catégorisation thématique' })

  // ── Séances ──
  await createCollection('seances', [
    { field: 'date', type: 'date', meta: { interface: 'datetime', required: true, width: 'half' }, schema: {} },
    { field: 'type', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Conseil municipal', value: 'conseil_municipal' },
      { text: 'Conseil communautaire', value: 'conseil_communautaire' },
    ] }, required: true, width: 'half' }, schema: {} },
    { field: 'collectivite', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'collectivites', foreign_key_column: 'id' } },
    { field: 'lieu', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'statut', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'À venir', value: 'a_venir' }, { text: 'Passée', value: 'passee' },
    ] }, width: 'half' }, schema: { default_value: 'a_venir' } },
    { field: 'ordre_jour', type: 'uuid', meta: { interface: 'file', special: ['file'] }, schema: {} },
    { field: 'pv', type: 'uuid', meta: { interface: 'file', special: ['file'] }, schema: {} },
    { field: 'video_url', type: 'string', meta: { interface: 'input' }, schema: {} },
  ], { icon: 'event', note: 'Séances du conseil' })

  // ── Délibérations ──
  await createCollection('deliberations', [
    { field: 'numero', type: 'string', meta: { interface: 'input', required: true, width: 'half' }, schema: { is_unique: true } },
    { field: 'titre', type: 'string', meta: { interface: 'input', required: true }, schema: {} },
    { field: 'resume_ia', type: 'text', meta: { interface: 'input-multiline', note: 'Résumé IA en français simple' }, schema: {} },
    { field: 'resume_humain', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
    { field: 'retranscription', type: 'text', meta: { interface: 'input-multiline', note: 'Débats et interventions' }, schema: {} },
    { field: 'texte_integral', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
    { field: 'seance', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'seances', foreign_key_column: 'id' } },
    { field: 'theme', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'themes', foreign_key_column: 'id' } },
    { field: 'pdf_original', type: 'uuid', meta: { interface: 'file', special: ['file'] }, schema: {} },
    { field: 'vote_pour', type: 'integer', meta: { interface: 'input', width: 'third' }, schema: { default_value: 0 } },
    { field: 'vote_contre', type: 'integer', meta: { interface: 'input', width: 'third' }, schema: { default_value: 0 } },
    { field: 'vote_abstention', type: 'integer', meta: { interface: 'input', width: 'third' }, schema: { default_value: 0 } },
    { field: 'budget_montant', type: 'float', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'statut', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Brouillon', value: 'brouillon' }, { text: 'Publié', value: 'publie' },
    ] }, width: 'half' }, schema: { default_value: 'brouillon' } },
  ], { icon: 'gavel', note: 'Délibérations du conseil' })

  // ── Élus ──
  await createCollection('elus', [
    { field: 'nom', type: 'string', meta: { interface: 'input', required: true, width: 'half' }, schema: {} },
    { field: 'prenom', type: 'string', meta: { interface: 'input', required: true, width: 'half' }, schema: {} },
    { field: 'photo', type: 'uuid', meta: { interface: 'file-image', special: ['file'] }, schema: {} },
    { field: 'liste_electorale', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'parti', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'mandats', type: 'json', meta: { interface: 'input-code', options: { language: 'json' }, note: 'Array de mandats [{collectivite, role, delegations, ordreAdjoint, commune}]' }, schema: {} },
    { field: 'hatvp_url', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'hatvp_statut', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Déclaration publiée', value: 'publiee' },
      { text: 'Non soumis', value: 'non_soumis' },
      { text: 'Soumis mais non trouvée', value: 'soumis_non_trouvee' },
    ] }, width: 'half' }, schema: {} },
    { field: 'condamnations', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
  ], { icon: 'person', note: 'Élus municipaux, communautaires, départementaux' })

  // ── Votes citoyens ──
  await createCollection('votes_citoyens', [
    { field: 'utilisateur', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'directus_users', foreign_key_column: 'id' } },
    { field: 'deliberation', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'deliberations', foreign_key_column: 'id' } },
    { field: 'choix', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Pour', value: 'pour' }, { text: 'Contre', value: 'contre' },
      { text: 'Abstention', value: 'abstention' }, { text: 'Sans avis', value: 'sans_avis' },
    ] }, required: true }, schema: {} },
  ], { icon: 'how_to_vote', note: 'Votes citoyens parallèles' })

  // ── Votes élus ──
  await createCollection('votes_elus', [
    { field: 'elu', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'elus', foreign_key_column: 'id' } },
    { field: 'deliberation', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'deliberations', foreign_key_column: 'id' } },
    { field: 'choix', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Pour', value: 'pour' }, { text: 'Contre', value: 'contre' },
      { text: 'Abstention', value: 'abstention' }, { text: 'Absent', value: 'absent' },
    ] }, required: true }, schema: {} },
  ], { icon: 'ballot', note: 'Votes nominatifs des élus' })

  // ── Commentaires ──
  await createCollection('commentaires', [
    { field: 'auteur', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'directus_users', foreign_key_column: 'id' } },
    { field: 'deliberation', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'deliberations', foreign_key_column: 'id' } },
    { field: 'type', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Argument pour', value: 'argument_pour' }, { text: 'Argument contre', value: 'argument_contre' },
      { text: 'Question', value: 'question' }, { text: 'Proposition alternative', value: 'proposition_alternative' },
    ] }, required: true }, schema: {} },
    { field: 'contenu', type: 'text', meta: { interface: 'input-multiline', required: true }, schema: {} },
    { field: 'modere', type: 'boolean', meta: { interface: 'boolean', width: 'half' }, schema: { default_value: false } },
    { field: 'signalements', type: 'integer', meta: { interface: 'input', width: 'half' }, schema: { default_value: 0 } },
  ], { icon: 'comment', note: 'Commentaires structurés' })

  // ── Pétitions ──
  await createCollection('petitions', [
    { field: 'titre', type: 'string', meta: { interface: 'input', required: true }, schema: {} },
    { field: 'description', type: 'text', meta: { interface: 'input-multiline', required: true }, schema: {} },
    { field: 'auteur', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'directus_users', foreign_key_column: 'id' } },
    { field: 'theme', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'themes', foreign_key_column: 'id' } },
    { field: 'seuil', type: 'integer', meta: { interface: 'input', width: 'half' }, schema: { default_value: 100 } },
    { field: 'nombre_signatures', type: 'integer', meta: { interface: 'input', width: 'half' }, schema: { default_value: 0 } },
    { field: 'statut', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Ouverte', value: 'ouverte' }, { text: 'Seuil atteint', value: 'seuil_atteint' },
      { text: 'Transmise', value: 'transmise' }, { text: 'Répondue', value: 'repondue' },
    ] } }, schema: { default_value: 'ouverte' } },
    { field: 'reponse_conseil', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
  ], { icon: 'draw', note: 'Pétitions citoyennes' })

  // ── Signatures (table de jonction pétitions ↔ users) ──
  await createCollection('petitions_signatures', [
    { field: 'petition', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'petitions', foreign_key_column: 'id' } },
    { field: 'utilisateur', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'directus_users', foreign_key_column: 'id' } },
  ], { icon: 'signature', note: 'Signatures de pétitions' })

  // ── Propositions ──
  await createCollection('propositions', [
    { field: 'titre', type: 'string', meta: { interface: 'input', required: true }, schema: {} },
    { field: 'description', type: 'text', meta: { interface: 'input-multiline', required: true }, schema: {} },
    { field: 'auteur', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'directus_users', foreign_key_column: 'id' } },
    { field: 'theme', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'themes', foreign_key_column: 'id' } },
    { field: 'seuil', type: 'integer', meta: { interface: 'input', width: 'half' }, schema: { default_value: 50 } },
    { field: 'nombre_soutiens', type: 'integer', meta: { interface: 'input', width: 'half' }, schema: { default_value: 0 } },
    { field: 'statut', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Ouverte', value: 'ouverte' }, { text: 'Seuil atteint', value: 'seuil_atteint' },
      { text: 'Étudiée', value: 'etudiee' }, { text: 'Acceptée', value: 'acceptee' }, { text: 'Refusée', value: 'refusee' },
    ] } }, schema: { default_value: 'ouverte' } },
  ], { icon: 'lightbulb', note: 'Propositions citoyennes' })

  // ── Signalements ──
  await createCollection('signalements', [
    { field: 'titre', type: 'string', meta: { interface: 'input', required: true }, schema: {} },
    { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
    { field: 'auteur', type: 'uuid', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'directus_users', foreign_key_column: 'id' } },
    { field: 'type', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Voirie', value: 'voirie' }, { text: 'Propreté', value: 'proprete' },
      { text: 'Éclairage', value: 'eclairage' }, { text: 'Transport', value: 'transport' },
      { text: 'Environnement', value: 'environnement' }, { text: 'Bruit', value: 'bruit' },
      { text: 'Sécurité', value: 'securite' },
    ] }, required: true }, schema: {} },
    { field: 'photo', type: 'uuid', meta: { interface: 'file-image', special: ['file'] }, schema: {} },
    { field: 'latitude', type: 'float', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'longitude', type: 'float', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'adresse', type: 'string', meta: { interface: 'input' }, schema: {} },
    { field: 'statut', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Signalé', value: 'signale' }, { text: 'Transmis', value: 'transmis' },
      { text: 'En cours', value: 'en_cours' }, { text: 'Résolu', value: 'resolu' }, { text: 'Rejeté', value: 'rejete' },
    ] } }, schema: { default_value: 'signale' } },
    { field: 'reponse', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
  ], { icon: 'report_problem', note: 'Signalements géolocalisés' })

  // ── Engagements ──
  await createCollection('engagements', [
    { field: 'description', type: 'text', meta: { interface: 'input-multiline', required: true }, schema: {} },
    { field: 'liste_electorale', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'source', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'theme', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'themes', foreign_key_column: 'id' } },
    { field: 'statut', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Pas commencé', value: 'pas_commence' }, { text: 'En cours', value: 'en_cours' },
      { text: 'Réalisé', value: 'realise' }, { text: 'Abandonné', value: 'abandonne' },
    ] }, required: true }, schema: { default_value: 'pas_commence' } },
    { field: 'commentaire', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
  ], { icon: 'task_alt', note: 'Engagements de campagne' })

  // ── Associations ──
  await createCollection('associations', [
    { field: 'nom', type: 'string', meta: { interface: 'input', required: true }, schema: {} },
    { field: 'description', type: 'text', meta: { interface: 'input-multiline' }, schema: {} },
    { field: 'theme', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'themes', foreign_key_column: 'id' } },
    { field: 'contact', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'site_web', type: 'string', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'adresse', type: 'string', meta: { interface: 'input' }, schema: {} },
    { field: 'horaires', type: 'string', meta: { interface: 'input' }, schema: {} },
    { field: 'logo', type: 'uuid', meta: { interface: 'file-image', special: ['file'] }, schema: {} },
  ], { icon: 'groups', note: 'Annuaire des associations' })

  // ── Présences ──
  await createCollection('presences', [
    { field: 'elu', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'elus', foreign_key_column: 'id' } },
    { field: 'seance', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'], required: true }, schema: { foreign_key_table: 'seances', foreign_key_column: 'id' } },
    { field: 'statut', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Présent', value: 'present' }, { text: 'Procuration', value: 'procuration' }, { text: 'Absent', value: 'absent' },
    ] }, required: true }, schema: {} },
    { field: 'procuration_a', type: 'string', meta: { interface: 'input' }, schema: {} },
  ], { icon: 'fact_check', note: 'Présences aux séances' })

  // ── Référendums ──
  await createCollection('referendums', [
    { field: 'titre', type: 'string', meta: { interface: 'input', required: true }, schema: {} },
    { field: 'description', type: 'text', meta: { interface: 'input-multiline', required: true }, schema: {} },
    { field: 'date_ouverture', type: 'date', meta: { interface: 'datetime', width: 'half' }, schema: {} },
    { field: 'date_cloture', type: 'date', meta: { interface: 'datetime', width: 'half' }, schema: {} },
    { field: 'deliberation_liee', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'deliberations', foreign_key_column: 'id' } },
    { field: 'resultats_pour', type: 'integer', meta: { interface: 'input', width: 'third' }, schema: { default_value: 0 } },
    { field: 'resultats_contre', type: 'integer', meta: { interface: 'input', width: 'third' }, schema: { default_value: 0 } },
    { field: 'resultats_abstention', type: 'integer', meta: { interface: 'input', width: 'third' }, schema: { default_value: 0 } },
    { field: 'statut', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'À venir', value: 'a_venir' }, { text: 'Ouvert', value: 'ouvert' }, { text: 'Clos', value: 'clos' },
    ] } }, schema: { default_value: 'a_venir' } },
  ], { icon: 'analytics', note: 'Référendums consultatifs' })

  // ── Notifications ──
  await createCollection('notifications', [
    { field: 'type', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Séance à venir', value: 'seance_a_venir' }, { text: 'Nouveau PV', value: 'nouveau_pv' },
    ] }, required: true }, schema: {} },
    { field: 'seance', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'seances', foreign_key_column: 'id' } },
    { field: 'sent_at', type: 'timestamp', meta: { interface: 'datetime', required: true }, schema: {} },
    { field: 'recipient_count', type: 'integer', meta: { interface: 'input', width: 'half' }, schema: {} },
    { field: 'status', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
      { text: 'Envoyé', value: 'sent' }, { text: 'Erreur', value: 'error' },
    ] }, width: 'half' }, schema: { default_value: 'sent' } },
    { field: 'error_message', type: 'string', meta: { interface: 'input' }, schema: {} },
  ], { icon: 'notifications', note: 'Historique des notifications' })

  // ── Ajouter des champs custom aux users Directus ──
  console.log('\n👤 Champs custom sur directus_users...')
  await createField('directus_users', { field: 'pseudo', type: 'string', meta: { interface: 'input', width: 'half', note: 'Pseudonyme public' }, schema: {} })
  await createField('directus_users', { field: 'role_citoyen', type: 'string', meta: { interface: 'select-dropdown', options: { choices: [
    { text: 'Citoyen', value: 'citoyen' }, { text: 'Modérateur', value: 'moderateur' }, { text: 'Admin', value: 'admin' },
  ] }, width: 'half' }, schema: { default_value: 'citoyen' } })
  await createField('directus_users', { field: 'commune', type: 'integer', meta: { interface: 'select-dropdown-m2o', special: ['m2o'] }, schema: { foreign_key_table: 'collectivites', foreign_key_column: 'id' } })
  await createField('directus_users', { field: 'newsletter', type: 'boolean', meta: { interface: 'boolean', width: 'half' }, schema: { default_value: false } })
  await createField('directus_users', { field: 'verifie', type: 'boolean', meta: { interface: 'boolean', width: 'half' }, schema: { default_value: false } })

  // ── Permissions publiques (lecture) ──
  console.log('\n🔓 Configuration des permissions publiques...')
  const publicCollections = [
    'collectivites', 'themes', 'seances', 'deliberations', 'elus',
    'votes_citoyens', 'votes_elus', 'commentaires', 'petitions', 'petitions_signatures',
    'propositions', 'signalements', 'engagements', 'associations',
    'presences', 'referendums', 'notifications',
  ]

  for (const collection of publicCollections) {
    await api('POST', '/permissions', {
      role: null, // null = public
      collection,
      action: 'read',
      fields: ['*'],
    })
    console.log(`   ✓ ${collection} — lecture publique`)
  }

  console.log('\n✅ Schéma créé avec succès !')
  console.log(`\n🌐 Admin Directus : ${DIRECTUS_URL}/admin`)
  console.log(`   Email : admin@plateforme-citoyenne.fr`)
  console.log(`   Mot de passe : admin`)
}

main().catch(err => {
  console.error('❌', err.message)
  process.exit(1)
})

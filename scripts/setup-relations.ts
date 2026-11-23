/**
 * Déclare à Directus les relations many-to-one des champs m2o.
 *
 * Les champs m2o ont été créés sans relation : Directus ne pouvait ni lire ni
 * trier à travers eux (ex. deliberations?sort=-seance.date → 403).
 * Directus 12 crée aussi la clé étrangère en base (sauf sur directus_users) :
 * supprimer une ligne encore référencée (séance avec délibérations, citoyen avec
 * votes…) est refusé. Échoue si des valeurs orphelines existent : les corriger avant.
 *
 * Non déclarés, cible à trancher (ancien modèle directus_users ou citoyens) :
 * petitions.auteur, petitions_signatures.utilisateur, propositions.auteur,
 * signalements.auteur.
 *
 * Usage : DIRECTUS_TOKEN=<jeton admin> npx tsx setup-relations.ts
 */
import { api } from './lib/directus'

const RELATIONS: [string, string, string][] = [
  ['associations', 'theme', 'themes'],
  ['collectivites', 'parent_canton', 'collectivites'],
  ['collectivites', 'parent_interco', 'collectivites'],
  ['commentaires', 'auteur', 'citoyens'],
  ['commentaires', 'deliberation', 'deliberations'],
  ['deliberations', 'seance', 'seances'],
  ['deliberations', 'theme', 'themes'],
  ['directus_users', 'commune', 'collectivites'],
  ['engagements', 'theme', 'themes'],
  ['notifications', 'seance', 'seances'],
  ['petitions', 'theme', 'themes'],
  ['petitions_signatures', 'petition', 'petitions'],
  ['presences', 'elu', 'elus'],
  ['presences', 'seance', 'seances'],
  ['propositions', 'theme', 'themes'],
  ['referendums', 'deliberation_liee', 'deliberations'],
  ['seances', 'collectivite', 'collectivites'],
  ['votes_citoyens', 'deliberation', 'deliberations'],
  ['votes_citoyens', 'utilisateur', 'citoyens'],
  ['votes_elus', 'deliberation', 'deliberations'],
  ['votes_elus', 'elu', 'elus'],
]

async function main() {
  const existing = new Set(
    ((await api('GET', '/relations')).data || []).map((r: any) => `${r.collection}.${r.field}`),
  )
  for (const [collection, field, related] of RELATIONS) {
    if (existing.has(`${collection}.${field}`)) { console.log(`⏭ ${collection}.${field}`); continue }
    await api('POST', '/relations', { collection, field, related_collection: related, schema: null })
    console.log(`✓ ${collection}.${field} → ${related}`)
  }
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

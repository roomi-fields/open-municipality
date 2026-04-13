/**
 * Import des prochaines séances CM LIJ + CC CCGT avec ordres du jour.
 * Source : sites officiels (avril 2026).
 */
import { login, getItems, createItem, updateItem } from './lib/directus'

const COLL_LIJ = 1
const COLL_CCGT = 2

interface OJItem { section: string; numero: number; titre: string }

const SEANCES = [
  {
    date: '2026-04-16',
    heure: '20:30',
    type: 'conseil_municipal',
    collectivite: COLL_LIJ,
    lieu: 'Salle du Conseil municipal',
    ordre_jour: [
      { section: 'Affaires générales', numero: 1, titre: 'Approbation du procès-verbal' },
      { section: 'Affaires générales', numero: 2, titre: 'Compte rendu des décisions prises par délégation de pouvoir' },
      { section: 'Affaires générales', numero: 3, titre: 'Délégation d\'attribution du conseil municipal au maire' },
      { section: 'Affaires générales', numero: 4, titre: 'Indemnités de fonction des élus' },
      { section: 'Désignations & représentations', numero: 5, titre: 'API Conseil d\'administration — Désignation des représentants' },
      { section: 'Désignations & représentations', numero: 6, titre: 'Commission d\'appel d\'offres — Élection des membres titulaires et suppléants' },
      { section: 'Désignations & représentations', numero: 7, titre: 'Commission de délégation de service public — Élection des membres' },
      { section: 'Désignations & représentations', numero: 8, titre: 'Fixation du nombre d\'administrateurs du CCAS' },
      { section: 'Désignations & représentations', numero: 9, titre: 'EHPAD Saint-Jacques — Désignation des délégués' },
      { section: 'Désignations & représentations', numero: 10, titre: 'Syndicat Territoire d\'Énergie Gers (STEG) — Délégués' },
      { section: 'Désignations & représentations', numero: 11, titre: 'SICTOM — Délégués' },
      { section: 'Désignations & représentations', numero: 12, titre: 'Convention d\'entente intercommunale et groupement de commandes' },
      { section: 'Désignations & représentations', numero: 13, titre: 'Établissements scolaires — Désignation de représentants' },
      { section: 'Désignations & représentations', numero: 14, titre: 'SAGE Neste et rivières de Gascogne — Désignation de représentants' },
      { section: 'Désignations & représentations', numero: 15, titre: 'Association foncière de remembrement d\'Endoufielle' },
      { section: 'Désignations & représentations', numero: 16, titre: '2x2 voies — Commission intercommunale d\'aménagement foncier agricole et forestier' },
      { section: 'Finances', numero: 17, titre: 'Impôts locaux — Vote des taux de la fiscalité directe locale pour 2026' },
      { section: 'Finances', numero: 18, titre: 'Fêtes et cérémonies — Dépenses à imputer aux comptes 6232 et 6234' },
      { section: 'Finances', numero: 19, titre: 'Vide d\'OC — Tarifs' },
      { section: 'Finances', numero: 20, titre: 'Arbres et Paysages 32 — Adhésion' },
      { section: 'Finances', numero: 21, titre: 'Coter Numérique — Adhésion 2026' },
      { section: 'Finances', numero: 22, titre: 'Principe de réalisation d\'un audit financier de la commune' },
      { section: 'Finances', numero: 23, titre: 'DSP Maison funéraire' },
      { section: 'Culture', numero: 24, titre: 'Pass Culture 32 — Convention - Avenant' },
      { section: 'Questions diverses', numero: 25, titre: 'Questions diverses' },
    ] as OJItem[],
  },
  { date: '2026-04-27', heure: '18:30', type: 'conseil_communautaire', collectivite: COLL_CCGT, lieu: 'Salle du Conseil communautaire CCGT', ordre_jour: [] },
  { date: '2026-06-18', heure: '18:30', type: 'conseil_communautaire', collectivite: COLL_CCGT, lieu: 'Salle du Conseil communautaire CCGT', ordre_jour: [] },
  { date: '2026-09-24', heure: '18:30', type: 'conseil_communautaire', collectivite: COLL_CCGT, lieu: 'Salle du Conseil communautaire CCGT', ordre_jour: [] },
  { date: '2026-11-12', heure: '18:30', type: 'conseil_communautaire', collectivite: COLL_CCGT, lieu: 'Salle du Conseil communautaire CCGT', ordre_jour: [] },
  { date: '2026-12-10', heure: '18:30', type: 'conseil_communautaire', collectivite: COLL_CCGT, lieu: 'Salle du Conseil communautaire CCGT', ordre_jour: [] },
]

async function main() {
  console.log('🗓  Import des prochaines séances\n')
  await login()

  for (const s of SEANCES) {
    const existing = await getItems('seances', `filter[date][_eq]=${s.date}&filter[collectivite][_eq]=${s.collectivite}&limit=1`)
    const payload = {
      date: s.date,
      type: s.type,
      collectivite: s.collectivite,
      lieu: s.lieu,
      statut: 'a_venir',
      ordre_jour_items: s.ordre_jour.length > 0 ? s.ordre_jour : null,
    }
    if (existing.length > 0) {
      await updateItem('seances', existing[0].id, payload)
      console.log(`  ✏️  ${s.date} — ${s.type} (${s.ordre_jour.length} points)`)
    } else {
      await createItem('seances', payload)
      console.log(`  ➕ ${s.date} — ${s.type} (${s.ordre_jour.length} points)`)
    }
  }
  console.log(`\n✅ ${SEANCES.length} séances importées`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

/**
 * Déduction du sexe à partir du prénom pour les élus sans sexe renseigné.
 */
import { login, getItems, updateItem } from './lib/directus'

// Règles heuristiques français (suffixes et cas particuliers)
const MASCULIN_EXACTS = new Set([
  'eric','denis','pierre','christophe','frederic','jean-michel','vivian','fabrice',
  'kamel','thibaut','yannick','jacques','francis','gabin','daniel','jean-claude',
  'benoit','julien','gerome','gerard','michel','philippe','remy','francois',
  'jean-sebastien','jean-marc','bernard','georges','jean-luc','gaetan','jean'
])
const FEMININ_EXACTS = new Set([
  'eloise','stephanie','delphine','corinne','geraldine','vanessa','estelle','helene',
  'berengere','audrey','alona','claudine','joelle','fanny','muriel','marie',
  'severine','martine','patricia','pascale','janine','marilyn','marylin','claire',
  'regine','josianne','brigitte','geraldine'
])

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim()
}

function deduce(prenom: string): 'M' | 'F' | null {
  const p = normalize(prenom)
  if (MASCULIN_EXACTS.has(p)) return 'M'
  if (FEMININ_EXACTS.has(p)) return 'F'
  // Heuristiques par suffixe
  if (/[aeiouy]e$/.test(p) || p.endsWith('ette') || p.endsWith('ine') || p.endsWith('ie') || p.endsWith('a')) return 'F'
  if (p.endsWith('o') || p.endsWith('in') || p.endsWith('an') || p.endsWith('ic') || p.endsWith('er') || p.endsWith('el')) return 'M'
  return null
}

async function main() {
  console.log('👤 Déduction du sexe à partir du prénom\n')
  await login()
  const elus = await getItems('elus', 'limit=500')
  let updated = 0, skipped = 0, unknown = 0
  for (const e of elus) {
    if (e.sexe) { skipped++; continue }
    const s = deduce(e.prenom)
    if (!s) {
      console.log(`  ❓ ${e.prenom} ${e.nom} — indéterminé`)
      unknown++
      continue
    }
    await updateItem('elus', e.id, { sexe: s })
    console.log(`  ${s === 'F' ? '♀' : '♂'} ${e.prenom} ${e.nom} → ${s}`)
    updated++
  }
  console.log(`\n📊 ${updated} mis à jour, ${skipped} déjà renseignés, ${unknown} indéterminés`)
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

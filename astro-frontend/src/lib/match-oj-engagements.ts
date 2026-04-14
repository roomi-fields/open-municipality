/**
 * Matching OJ ↔ Engagements via classification thématique.
 * Chaque texte (OJ item ou engagement) est classé dans 1..N topics d'après des mots-clés.
 * Un OJ et un engagement matchent s'ils partagent ≥1 topic.
 */

// Dictionnaire topic → mots-clés (normalisés : minuscule + sans accents)
const TOPICS: Record<string, string[]> = {
  finances: ['impot', 'taxe', 'fiscal', 'foncier', 'budget', 'audit', 'depense', 'subvention', 'emprunt', 'tresorerie', 'financi', 'compte'],
  culture: ['culture', 'patrimoine', 'musee', 'mediatheque', 'cinema', 'spectacle', 'festival', 'artistique', 'pass culture'],
  education: ['ecole', 'scolaire', 'college', 'lycee', 'education', 'perisco', 'crechee', 'creche', 'enfance', 'petite enfance', 'jeunesse', 'cantine', 'restauration', 'api conseil'],
  social: ['social', 'solidar', 'senior', 'aine', 'mutuelle', 'sante', 'ccas', 'ehpad', 'residence autonomie', 'handicap', 'logement social'],
  environnement: ['environnement', 'ecolog', 'arbre', 'paysage', 'vegetal', 'climat', 'transition', 'sobriete', 'led', 'photovolt', 'energie'],
  eau: ['eau', 'assainissement', 'captage', 'save', 'riviere', 'sage', 'epuration'],
  dechets: ['dechet', 'sictom', 'decheterie', 'tri', 'recyclage', 'redevance'],
  urbanisme: ['urbanisme', 'plu', 'plui', 'habitat', 'logement', 'amenagement', 'construction', 'demolition', 'foncier', 'remembr', 'endoufielle'],
  transport: ['transport', 'mobilite', 'cyclable', 'piste', 'bus', 'navette', 'tad', 'til', 'gare', 'serm', 'voirie', 'parking', 'circulation'],
  securite: ['securite', 'police', 'gendarm', 'video', 'tranquillite', 'prevention'],
  democratie: ['democrati', 'participa', 'citoyen', 'concertation', 'conseil des jeunes', 'application citoyen', 'numerique'],
  sport: ['sport', 'piscine', 'stade', 'terrain', 'gymnase'],
  commerce: ['commerce', 'marche', 'artisan', 'tourisme', 'entreprise', 'economi', 'vitrine', 'vide'],
  associations: ['association', 'benevol', 'vie associative', 'ludotheque'],
  funeraire: ['funerai', 'cimetier', 'obseques', 'pompes funebr', 'concession'],
  ethique: ['ethique', 'transparence', 'charte', 'hatvp', 'conflit interet'],
  ressources_humaines: ['effectif', 'emploi', 'teletravail', 'tableau des emplois', 'reglement de formation', 'rh'],
  voirie_travaux: ['voirie', 'trottoir', 'pont', 'route', 'refection', 'pluviale', 'batiment'],
}

function normalize(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/['\u2019]/g, ' ').replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ').trim()
}

export function classifyTopics(text: string): Set<string> {
  const norm = ' ' + normalize(text) + ' '
  const topics = new Set<string>()
  for (const [topic, keywords] of Object.entries(TOPICS)) {
    for (const kw of keywords) {
      if (norm.includes(' ' + kw) || norm.includes(kw + ' ')) { topics.add(topic); break }
    }
  }
  return topics
}

export interface Engagement {
  id: number
  description: string
  statut?: string
}

export interface Match { engagement: Engagement; sharedTopics: string[] }

export function matchEngagements(
  ojTitle: string,
  engagements: Engagement[],
  opts: { maxResults?: number } = {}
): Match[] {
  const maxResults = opts.maxResults ?? 3
  const ojTopics = classifyTopics(ojTitle)
  if (ojTopics.size === 0) return []

  const matches: Match[] = []
  for (const e of engagements) {
    const eTopics = classifyTopics(e.description)
    const shared = [...ojTopics].filter(t => eTopics.has(t))
    if (shared.length === 0) continue
    matches.push({ engagement: e, sharedTopics: shared })
  }

  matches.sort((a, b) => b.sharedTopics.length - a.sharedTopics.length)
  return matches.slice(0, maxResults)
}

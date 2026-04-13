# Open Municipality — Plateforme Citoyenne

Plateforme citoyenne open source de transparence et participation démocratique municipale.

**Cible initiale :** L'Isle-Jourdain (Gers) + CC Gascogne Toulousaine.
**Vision :** réseau multi-échelons (commune → interco → canton → département → national) où les données se croisent naturellement.

## Les 5 piliers fonctionnels

1. **COMPRENDRE** — Délibérations indexées, résumés IA, contexte
2. **PARTICIPER** — Vote citoyen parallèle, commentaires, propositions
3. **SIGNALER** — Signalements géolocalisés, pétitions, référendums
4. **SUIVRE** — Engagements de campagne, bilan chiffré, budget
5. **CONNECTER** — Interco, associations, newsletter/radio

## Stack technique

```
┌──────────────────┐     ┌───────────────────────┐
│   Directus 11     │     │    Astro 6 (SSR)       │
│   (port 8055)     │────>│    (port 3333)         │
│  Admin + REST API │     │    + React Islands     │
│  PostgreSQL 16    │     │    + Tailwind CSS v4   │
└──────────────────┘     └───────────────────────┘
         │
         └── Scripts TypeScript autonomes (scraping, parsing, imports)
```

## Structure

```
v2/
├── astro-frontend/         # Frontend Astro (SSR) + React Islands
├── scripts/                # Scrapers, parsers, imports (tsx)
│   ├── scraper.ts          # Découvre les PV sur les sites publics
│   ├── scraper-seances.ts  # Veille auto des prochaines séances + OJ
│   ├── parse-pv.ts         # PDF → JSON via Claude API
│   ├── import-pv-json.ts   # JSON → Directus
│   ├── pipeline.ts         # Orchestre scrape + parse + import
│   ├── notify-seances.ts   # Email J-7 (Brevo)
│   └── README.md           # Doc complète scripts
├── docker-compose.yml      # Directus + PostgreSQL
├── .env.example            # Variables d'environnement
└── data/                   # PDFs, JSON, states (gitignored)
```

## Démarrage

```bash
# 1. CMS Directus + PostgreSQL
cp .env.example .env  # puis éditer les secrets
docker-compose up -d

# 2. Frontend Astro (dev)
cd astro-frontend
npm install
PORT=3333 npm run dev

# 3. Seed initial
cd ../scripts
npm install
npx tsx setup-schema.ts  # crée collections Directus
npx tsx seed.ts          # données de base
```

## Automatisations actives

| Script | Fréquence | Rôle |
|---|---|---|
| `scraper-seances.ts` | 6h | Veille des prochaines séances + OJ (parsing Claude haiku) |
| `pipeline.ts` | 12h | Scrape + parse + import PV passés |
| `notify-seances.ts` | quotidien | Email J-7 via Brevo |

Voir [`scripts/README.md`](scripts/README.md) pour le détail.

## Conventions

- **Neutralité politique** : pas de propagande pour une liste
- **Friction minimale** pour l'inscription citoyen
- **Langue** : français
- **Open source** — déployable par toute commune

## Licence

MIT

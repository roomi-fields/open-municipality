# Scripts — Open Municipality v2

Scripts TypeScript autonomes (Node + tsx + Directus REST).

## Pipeline scraping & import

```
sites publics  →  scraper.ts          →  state JSON
                  scraper-seances.ts  →  Directus (séances + OJ)

PDF             →  parse-pv.ts        →  JSON structuré (Claude API)
JSON            →  import-pv-json.ts  →  Directus (séance + délibs + votes + présences)

orchestration   →  pipeline.ts        →  scrape + parse + import (cron 12h)
notifications   →  notify-seances.ts  →  email J-7 (Brevo)
```

## Scripts opérationnels

### Veille des séances à venir (cron recommandé : toutes les 6h)

**`scraper-seances.ts`** — Détecte automatiquement les prochaines séances et leurs ordres du jour.

- Source 1 : `mairie-islejourdain.fr/seances-conseil-municipal`
- Source 2 : `ccgascognetoulousaine.com/.../les-seances-du-conseil-communautaire/`
- Action 1 : extrait toutes les dates futures + URLs des PDFs OJ/dossier de séance
- Action 2 : upsert chaque séance (statut `a_venir`, lieu, heure)
- Action 3 : pour chaque OJ nouveau → download → Claude (haiku-4-5) → JSON `[{section, numero, titre}]` → update `seances.ordre_jour_items`
- Idempotent — état dans `data/seances-state.json`
- Coût : ~0,002 $/PDF (Claude haiku) — négligeable

```bash
npx tsx scraper-seances.ts        # one-shot
crontab -e
0 */6 * * * cd /path/to/scripts && /usr/local/bin/npx tsx scraper-seances.ts >> /var/log/scraper-seances.log 2>&1
```

### Pipeline historique des PV

**`scraper.ts`** — Découvre les PDFs sur les sites (PV passés). State : `data/scraper-state.json`.

**`parse-pv.ts`** — Parse un PDF de PV avec Claude (sonnet-4-5) → JSON `ParsedPV` (séance, conseillers avec présences, délibérations avec votes nominatifs, débats, montants).

**`import-pv-json.ts`** — Import un JSON `ParsedPV` dans Directus :
- upsert séance (par date)
- find-or-create élus (par nom/prénom normalisé)
- créer présences
- créer délibérations + thèmes auto-classifiés
- créer votes_elus pour chaque conseiller × chaque délibération

**`pipeline.ts`** — Orchestre : scrape → parse → import (3 PDFs/cycle max). Cron 12h.

### Notifications

**`notify-seances.ts`** — Envoie un email J-7 avant chaque séance via Brevo. Cron quotidien.

## Imports ponctuels

| Script | Rôle |
|---|---|
| `import-rne.ts` | Import élus depuis le Répertoire National des Élus (data.gouv.fr) |
| `import-mandats-sociaux.ts` | Recherche mandats sociaux/SCI sur recherche-entreprises.api.gouv.fr |
| `import-hatvp.ts` | Lien vers déclarations d'intérêts HATVP |
| `update-conseil-2026.ts` | Mise à jour conseil municipal LIJ 2026 (mandat Bizard) |
| `update-ccgt-2026.ts` | Mise à jour conseil communautaire CCGT 2026 |
| `import-prochaines-seances.ts` | Seed manuel des séances à venir + OJ structurés |
| `deduce-sexe.ts` | Heuristique F/M sur prénoms pour stats |
| `seed.ts` | Seed initial (collectivités, thèmes, démo) |
| `setup-schema.ts` | Création/mise à jour du schéma Directus |

## Configuration

`.env` à la racine `v2/` :
```
DIRECTUS_URL=http://localhost:8055
DIRECTUS_EMAIL=admin@example.com
DIRECTUS_PASSWORD=...
ANTHROPIC_API_KEY=sk-ant-...        # parsing PV/OJ
BREVO_API_KEY=xkeysib-...           # notifications email
```

## Schéma Directus utilisé

| Collection | Champs clés |
|---|---|
| `collectivites` | id, nom, type (commune/interco/canton), code_insee |
| `seances` | date, type, collectivite, lieu, statut (a_venir/passee), ordre_jour (PDF), **ordre_jour_items** (json) |
| `deliberations` | numero, titre, resume_ia, retranscription, theme, seance, vote_pour, vote_contre, vote_abstention, statut |
| `elus` | nom, prenom, sexe, profession, mandats (json), liste_electorale, mandats_sociaux (json), delegations |
| `votes_elus` | elu, deliberation, choix |
| `presences` | elu, seance, statut, procuration_a |
| `themes`, `engagements`, `petitions`, `signalements`, `propositions`, `commentaires`, `notifications` |

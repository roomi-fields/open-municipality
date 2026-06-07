# Déploiement — Open Municipality

Prod VPS Hostinger KVM2 + reverse proxy déjà en place côté hôte.

## Pré-requis sur le VPS

- Docker + docker compose plugin
- Accès SSH root
- Reverse proxy (Caddy/nginx/Traefik) qui peut ajouter des vhosts vers `127.0.0.1:PORT`
- DNS configurés pour le domaine cible :
  - `plateformecitoyennelisloise.fr` → IP VPS
  - `admin.plateformecitoyennelisloise.fr` → IP VPS
  - `stats.plateformecitoyennelisloise.fr` → IP VPS (si Plausible activé)

## Étapes

### 1. Cloner le repo

```bash
ssh root@VPS
cd /opt
git clone https://github.com/roomi-fields/open-municipality.git
cd open-municipality/v2
```

### 2. Créer `.env.prod`

```bash
cp .env.prod.example .env.prod
nano .env.prod
```

Générer des secrets forts :
```bash
openssl rand -hex 32    # POSTGRES_PASSWORD, ADMIN_PASSWORD, PLAUSIBLE_POSTGRES_PASSWORD
openssl rand -hex 48    # DIRECTUS_SECRET, JWT_SECRET
openssl rand -base64 48 # PLAUSIBLE_SECRET_KEY_BASE
```

Renseigner :
- `BREVO_API_KEY` (emails transactionnels)
- `BREVO_SMTP_USER` / `BREVO_SMTP_PASSWORD` (pour Plausible SMTP)
- `EMAIL_FROM_ADDR` — adresse expéditrice vérifiée dans Brevo
- `ANTHROPIC_API_KEY` (parsing PV + OJ)

### 3. Démarrer la stack

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod up -d --build
docker compose -f docker-compose.prod.yml --env-file .env.prod logs -f directus
```

Services exposés (bindés sur 127.0.0.1) :
- **3333** — Astro SSR (front public)
- **8055** — Directus (admin + API)
- **8000** — Plausible (si activé)

### 4. Configurer le reverse proxy hôte

#### Caddy (exemple)

```caddy
plateformecitoyennelisloise.fr {
  reverse_proxy 127.0.0.1:3333
}

admin.plateformecitoyennelisloise.fr {
  reverse_proxy 127.0.0.1:8055
}

stats.plateformecitoyennelisloise.fr {
  reverse_proxy 127.0.0.1:8000
}
```

#### nginx (exemple)

```nginx
server {
  listen 443 ssl http2;
  server_name plateformecitoyennelisloise.fr;
  # ... ssl_certificate ...
  location / {
    proxy_pass http://127.0.0.1:3333;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}

server {
  listen 443 ssl http2;
  server_name admin.plateformecitoyennelisloise.fr;
  # ... ssl_certificate ...
  location / {
    proxy_pass http://127.0.0.1:8055;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }
}
```

### 5. Initialisation des données

Une fois Directus accessible sur l'admin, lancer les seeds + imports :

```bash
docker compose -f docker-compose.prod.yml --env-file .env.prod exec scraper-pv sh
# dans le container :
node --import tsx setup-schema.ts
node --import tsx setup-articles-schema.ts
node --import tsx setup-auth-schema.ts
node --import tsx seed.ts
node --import tsx update-conseil-2026.ts
node --import tsx update-ccgt-2026.ts
node --import tsx import-prochaines-seances.ts
node --import tsx migrate-wp-articles.ts
exit
```

### 6. Vérifier

- `https://plateformecitoyennelisloise.fr` → landing
- `https://admin.plateformecitoyennelisloise.fr` → Directus admin (login `ADMIN_EMAIL` / `ADMIN_PASSWORD`)
- `https://stats.plateformecitoyennelisloise.fr` → Plausible (créer un admin + un site `plateformecitoyennelisloise.fr`)

### 7. Délivrabilité email

Pour que les magic links n'atterrissent pas en spam :

1. Ajouter `plateformecitoyennelisloise.fr` comme **domaine vérifié** dans Brevo
2. Suivre leurs instructions DNS :
   - Enregistrement TXT SPF
   - Enregistrement CNAME DKIM
   - (Optionnel) DMARC

Une fois validé, changer `EMAIL_FROM_ADDR` dans `.env.prod` vers une adresse du domaine.

## Mises à jour

Voir aussi `HOWTO-DEPLOY.md` pour la procédure idiot-proof avec `REDEPLOY.sh` (dump local → restore prod + rebuild). Quelques points à ne pas oublier :

### Avant de lancer `REDEPLOY.sh`

1. **Commit + push** tes modifs locales sur `origin/main` — le script fait `git reset --hard origin/main`, donc tout ce qui n'est pas poussé sera ignoré (et tout fichier modifié à la main sur le VPS et tracké en git sera écrasé).
2. **Hotfixes appliqués à chaud sur le VPS** (édition directe d'un fichier tracké) : remonte-les en git avant le redéploiement, sinon ils sont perdus. Les fichiers **non trackés** (`.env.prod`, `docker-compose.override.yml`) sont préservés.
3. **`PUBLIC_DIRECTUS_URL`** doit être renseigné dans `.env.prod` (et `astro-frontend/Dockerfile` doit l'exposer en `ARG`/`ENV` au stage de build, sinon le SDK Directus retombe sur `http://localhost:8055` → contenu mixte → cadenas rouge sur HTTPS).

### Mise à jour code seulement (sans toucher à la DB)

```bash
cd /opt/open-municipality
git pull
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml --env-file .env.prod up -d --build frontend
```

## Sauvegarde

Volumes importants à sauvegarder régulièrement :
- `pg_data` — base Directus (délibérations, élus, citoyens, votes, engagements)
- `directus_uploads` — fichiers uploadés
- `plausible_db` + `plausible_events` — stats

```bash
docker run --rm -v v2_pg_data:/data -v $(pwd):/backup alpine tar czf /backup/pg_backup_$(date +%F).tgz -C /data .
```

## Troubleshooting

- **Directus ne démarre pas** : vérifier `docker compose logs directus` + que postgres est `healthy`
- **Astro ne peut pas joindre Directus** : tous les containers sont sur le même network `v2_default`, le hostname est `directus`, pas `localhost`
- **Emails non reçus** : vérifier `docker compose logs frontend | grep mail` — le code log "Brevo OK" + messageId si envoi accepté. Problème = délivrabilité (SPF/DKIM du domaine sender)
- **Claude API "credit too low"** : recharger sur console.anthropic.com, le scraper continuera au prochain cycle

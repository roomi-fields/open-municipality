# HOWTO — Déploiement Open Municipality

VPS Hostinger 72.61.97.213, Traefik existant, accessible via `https://om.noos-ia.com`.

## URLs & accès

| Service | URL |
|---|---|
| Frontend public | https://om.noos-ia.com |
| Admin Directus | https://admin.om.noos-ia.com |
| SSH VPS | `ssh -i ~/.ssh/claude_hostinger_temp root@72.61.97.213` |
| Dossier app | `/opt/open-municipality` |
| Repo | https://github.com/roomi-fields/open-municipality |

Admin Directus : `admin@plateforme-citoyenne.fr` / `admin` (à changer en prod via UI Directus, et synchroniser `.env.prod`).

---

## ⚡ Cas le plus fréquent : "j'ai modifié des choses en local, redéploie la prod"

**1 seul commande à exécuter**, qui copie l'état exact de la base locale vers la prod et reconstruit le frontend avec le code de la branche `main`.

### Sur le poste local (génération du dump)

```bash
docker exec v2-postgres-1 pg_dump -U om_user -d open_municipality \
  --no-owner --no-acl --clean --if-exists > /tmp/om_local_dump.sql

scp -i ~/.ssh/claude_hostinger_temp /tmp/om_local_dump.sql \
  root@72.61.97.213:/tmp/
```

### Sur le VPS (mise à jour)

```bash
ssh -i ~/.ssh/claude_hostinger_temp root@72.61.97.213
cd /opt/open-municipality
bash REDEPLOY.sh
```

Le script `REDEPLOY.sh` (voir plus bas, à créer si absent) fait :
1. `git pull`
2. Restore `/tmp/om_local_dump.sql` dans Postgres
3. Sync `.env.prod` (admin email/password = ceux du dump)
4. Rebuild + restart frontend (avec `PUBLIC_DIRECTUS_URL` injecté au build)
5. Affiche le récap des données présentes

**C'est tout.** Pas de patches manuels, pas de seeds à relancer.

### Script `REDEPLOY.sh` (à placer à la racine du repo)

```bash
#!/bin/sh
set -e
cd /opt/open-municipality

echo "=== 1. Pull derniers changements ==="
git fetch origin
git reset --hard origin/main

echo "=== 2. Stop services applicatifs (postgres reste up) ==="
cd v2
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml \
  --env-file .env.prod stop frontend directus scraper-seances scraper-pv rne-updater notifier

echo "=== 3. Restore du dump local ==="
if [ ! -f /tmp/om_local_dump.sql ]; then
  echo "❌ /tmp/om_local_dump.sql introuvable — uploade-le avec scp d'abord"
  exit 1
fi

docker exec open-municipality-postgres-1 psql -U om_user -d open_municipality \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO om_user;"

docker cp /tmp/om_local_dump.sql open-municipality-postgres-1:/tmp/dump.sql
docker exec open-municipality-postgres-1 psql -U om_user -d open_municipality -f /tmp/dump.sql > /tmp/restore.log 2>&1
echo "  ✓ Dump restauré (log : /tmp/restore.log)"

echo "=== 4. Sync admin credentials .env.prod (= ceux du dump local) ==="
sed -i 's|^ADMIN_EMAIL=.*|ADMIN_EMAIL=admin@plateforme-citoyenne.fr|' .env.prod
sed -i 's|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=admin|' .env.prod

echo "=== 5. Rebuild + restart ==="
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml \
  --env-file .env.prod up -d --build --force-recreate \
  frontend directus scraper-seances scraper-pv rne-updater notifier

echo "=== 6. Attendre que tout soit healthy ==="
sleep 8

echo "=== 7. Récap données ==="
for c in collectivites elus deliberations engagements articles seances themes citoyens commentaires; do
  count=$(curl -sk "https://admin.om.noos-ia.com/items/$c?limit=0&meta=total_count" \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('meta',{}).get('total_count','?'))")
  echo "  $c : $count"
done

echo ""
echo "✅ Déploiement terminé. Tester :"
echo "  - https://om.noos-ia.com"
echo "  - https://admin.om.noos-ia.com (login : admin@plateforme-citoyenne.fr / admin)"
```

---

## Cas n°2 : "juste un changement de code, pas de DB"

```bash
ssh -i ~/.ssh/claude_hostinger_temp root@72.61.97.213
cd /opt/open-municipality
git pull
cd v2
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml \
  --env-file .env.prod up -d --build --force-recreate frontend
```

---

## Cas n°3 : "déploiement initial / from scratch"

### 1. Cloner et configurer

```bash
ssh -i ~/.ssh/claude_hostinger_temp root@72.61.97.213
cd /opt
git clone https://github.com/roomi-fields/open-municipality.git
cd open-municipality/v2

cp .env.prod.example .env.prod
# Éditer .env.prod : générer secrets avec openssl rand -hex 48
nano .env.prod
```

Variables minimum :
```env
SITE_URL=https://om.noos-ia.com
DIRECTUS_PUBLIC_URL=https://admin.om.noos-ia.com
PUBLIC_DIRECTUS_URL=https://admin.om.noos-ia.com
POSTGRES_PASSWORD=...           # openssl rand -hex 32
DIRECTUS_SECRET=...             # openssl rand -hex 48
ADMIN_EMAIL=admin@plateforme-citoyenne.fr
ADMIN_PASSWORD=admin            # à changer dans Directus + ici après
JWT_SECRET=...                  # openssl rand -hex 48
BREVO_API_KEY=xkeysib-...
EMAIL_FROM_ADDR=brevo@liance.art
ANTHROPIC_API_KEY=              # optionnel V1
```

### 2. Override docker-compose pour Traefik

Créer `docker-compose.override.yml` :

```yaml
services:
  frontend:
    ports: !reset []
    networks:
      - default
      - traefik-network
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik-network"
      - "traefik.http.routers.om.rule=Host(`om.noos-ia.com`)"
      - "traefik.http.routers.om.entrypoints=websecure"
      - "traefik.http.routers.om.tls=true"
      - "traefik.http.routers.om.tls.certresolver=letsencrypt"
      - "traefik.http.services.om.loadbalancer.server.port=3333"

  directus:
    ports: !reset []
    networks:
      - default
      - traefik-network
    labels:
      - "traefik.enable=true"
      - "traefik.docker.network=traefik-network"
      - "traefik.http.routers.om-admin.rule=Host(`admin.om.noos-ia.com`)"
      - "traefik.http.routers.om-admin.entrypoints=websecure"
      - "traefik.http.routers.om-admin.tls=true"
      - "traefik.http.routers.om-admin.tls.certresolver=letsencrypt"
      - "traefik.http.services.om-admin.loadbalancer.server.port=8055"

  plausible_db:
    profiles: [plausible]
  plausible_events_db:
    profiles: [plausible]
  plausible:
    profiles: [plausible]

networks:
  traefik-network:
    external: true
```

### 3. DNS

- `om.noos-ia.com` → `72.61.97.213` (A record)
- `admin.om.noos-ia.com` → `72.61.97.213` (A record)

### 4. Lancer la stack

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml \
  --env-file .env.prod up -d --build
```

### 5. Seed (idempotent)

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml \
  --env-file .env.prod exec -T scraper-pv sh seed-all.sh
```

C'est tout. Tous les scripts du seed sont idempotents et peuvent être relancés sans casse.

---

## Permissions Directus (Public policy)

Directus v11 utilise des **policies** (pas juste des roles) pour les permissions. La policy Public est créée par défaut. ID typique : `abf8a154-5b1c-4a46-ac9c-7300570f4f17`.

Si une collection n'est pas accessible publiquement (404 sur la page front avec page vide), créer la permission :

```bash
TOKEN=$(curl -sk -X POST https://admin.om.noos-ia.com/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@plateforme-citoyenne.fr","password":"admin"}' | \
  python3 -c "import sys,json; print(json.load(sys.stdin)['data']['access_token'])")

# Récupérer l'ID de la policy Public
POLICY=$(curl -sk "https://admin.om.noos-ia.com/policies?filter[name][_eq]=\$t:public_label" \
  -H "Authorization: Bearer $TOKEN" | python3 -c "import sys,json; print(json.load(sys.stdin)['data'][0]['id'])")

# Pour une collection (ex: articles)
curl -sk -X POST https://admin.om.noos-ia.com/permissions \
  -H 'Content-Type: application/json' \
  -H "Authorization: Bearer $TOKEN" \
  -d "{\"policy\":\"$POLICY\",\"collection\":\"articles\",\"action\":\"read\",\"fields\":[\"*\"]}"
```

Mais normalement, **les scripts `setup-*-schema.ts` et `setup-roles-moderation.ts` créent automatiquement les permissions nécessaires.**

---

## Vérification post-déploiement

```bash
# 1. Frontend répond
curl -sI https://om.noos-ia.com | head -2

# 2. Admin répond
curl -sk https://admin.om.noos-ia.com/server/ping  # → "pong"

# 3. Compter les données
for c in collectivites elus deliberations engagements articles seances themes citoyens; do
  echo -n "$c : "
  curl -sk "https://admin.om.noos-ia.com/items/$c?limit=0&meta=total_count" | \
    python3 -c "import sys,json; print(json.load(sys.stdin).get('meta',{}).get('total_count','?'))"
done

# 4. Tester un article (rendu HTML attendu)
curl -s https://om.noos-ia.com/blog | grep -c '<article'

# 5. Tester l'auth magic link (devrait retourner ok:true)
curl -s -X POST https://om.noos-ia.com/api/auth/request \
  -H 'Content-Type: application/json' \
  -d '{"email":"roomi@liance.art"}'
```

Valeurs attendues après seed complet :
- collectivites : 16
- elus : 170+
- deliberations : 39 (14 publiées + 25 à venir)
- engagements : 41
- articles : 15
- seances : 7

---

## Debug

```bash
docker logs open-municipality-frontend-1 --tail 50
docker logs open-municipality-directus-1 --tail 50

# Inspecter les emails simulés
docker logs open-municipality-frontend-1 | grep mail
```

### Page liste vide mais API OK

Vérifier que `PUBLIC_DIRECTUS_URL` était bien défini au **build** du frontend :
```bash
docker exec open-municipality-frontend-1 grep -r "PUBLIC_DIRECTUS_URL\|admin.om.noos-ia.com" /app/dist/server/ | head -3
```

Si on voit `localhost:8055` dans le bundle compilé, refaire `docker compose up -d --build --force-recreate frontend` après s'être assuré que `PUBLIC_DIRECTUS_URL` est bien dans `.env.prod`.

### "Cross-site POST forbidden" à la déconnexion / vote

Astro 4+ refuse les POST cross-origin par défaut. Le repo a `security.checkOrigin: false` dans `astro.config.mjs`. Si le bug réapparaît, vérifier que ce paramètre n'a pas été retiré.

### Magic link pointe vers localhost

Vérifier que `SITE_URL` est dans `.env.prod` ET passé au container frontend (vérifier le block `environment` du `frontend:` dans `docker-compose.prod.yml`). Le code utilise `process.env.SITE_URL` en priorité sur `request.url`.

---

## Services background (cron auto via docker)

Pour gérer les containers individuellement :

```bash
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml \
  --env-file .env.prod logs -f scraper-seances

# Stopper / démarrer
docker compose ... stop scraper-pv
docker compose ... start scraper-pv
```

| Container | Fréquence | Rôle |
|---|---|---|
| scraper-seances | 6h | Détecte nouveaux OJ + parsing Claude |
| scraper-pv | 12h | Détecte nouveaux PV + import via pipeline |
| rne-updater | 30j | Refresh élus depuis data.gouv |
| notifier | 24h | Email J-7 aux abonnés CM (Brevo) |

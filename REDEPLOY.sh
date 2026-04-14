#!/bin/sh
# Redéploiement complet de la prod depuis un dump local + dernier code GitHub.
# À lancer sur le VPS après avoir uploadé /tmp/om_local_dump.sql.
#
# Usage : bash REDEPLOY.sh
set -e

DUMP="/tmp/om_local_dump.sql"

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"
REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$SCRIPT_DIR")"

echo "===== 1. Pull derniers changements ====="
cd "$REPO_ROOT"
git fetch origin
git reset --hard origin/main
cd "$SCRIPT_DIR"

echo ""
echo "===== 2. Stop services applicatifs (postgres reste up) ====="
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml \
  --env-file .env.prod stop frontend directus scraper-seances scraper-pv rne-updater notifier 2>/dev/null || true

echo ""
echo "===== 3. Restore du dump local ====="
if [ ! -f "$DUMP" ]; then
  echo "❌ $DUMP introuvable. Upload-le depuis ton poste local :"
  echo "   scp -i ~/.ssh/claude_hostinger_temp /tmp/om_local_dump.sql root@$(hostname -I|cut -d' ' -f1):/tmp/"
  exit 1
fi

docker exec open-municipality-postgres-1 psql -U om_user -d open_municipality \
  -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public; GRANT ALL ON SCHEMA public TO om_user;" >/dev/null

docker cp "$DUMP" open-municipality-postgres-1:/tmp/dump.sql
docker exec open-municipality-postgres-1 psql -U om_user -d open_municipality -f /tmp/dump.sql > /tmp/restore.log 2>&1
echo "  ✓ Dump restauré (log : /tmp/restore.log)"

echo ""
echo "===== 4. Sync admin credentials .env.prod (= ceux du dump local) ====="
sed -i 's|^ADMIN_EMAIL=.*|ADMIN_EMAIL=admin@plateforme-citoyenne.fr|' .env.prod
sed -i 's|^ADMIN_PASSWORD=.*|ADMIN_PASSWORD=admin|' .env.prod

echo ""
echo "===== 5. Rebuild + restart (force recreate, --build pour le nouveau code) ====="
docker compose -f docker-compose.prod.yml -f docker-compose.override.yml \
  --env-file .env.prod up -d --build --force-recreate \
  frontend directus scraper-seances scraper-pv rne-updater notifier

echo ""
echo "===== 6. Attendre que tout soit healthy (~10s) ====="
sleep 10

echo ""
echo "===== 7. Récap données ====="
SITE_URL=$(grep -E '^DIRECTUS_PUBLIC_URL=' .env.prod | cut -d= -f2)
for c in collectivites elus deliberations engagements articles seances themes citoyens commentaires; do
  count=$(curl -sk "$SITE_URL/items/$c?limit=0&meta=total_count" 2>/dev/null \
    | python3 -c "import sys,json; print(json.load(sys.stdin).get('meta',{}).get('total_count','?'))" 2>/dev/null || echo "?")
  printf "  %-18s : %s\n" "$c" "$count"
done

echo ""
SITE_URL_PUB=$(grep -E '^SITE_URL=' .env.prod | cut -d= -f2)
echo "✅ Déploiement terminé. Tester :"
echo "  - $SITE_URL_PUB"
echo "  - $SITE_URL (login admin@plateforme-citoyenne.fr / admin)"

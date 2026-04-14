#!/bin/sh
# Seed/maj idempotent — peut être lancé autant de fois que nécessaire.
# Tous les scripts sont conçus pour être idempotents (skip si déjà fait).
#
# Usage (depuis le container scraper-pv) :
#   docker compose ... exec scraper-pv sh seed-all.sh
#
# Variables d'env requises (héritées du compose) :
#   DIRECTUS_URL, ADMIN_EMAIL, ADMIN_PASSWORD

set -e
cd /app

echo "===== 1/10 setup-schema ====="
node --import tsx setup-schema.ts || echo "  ⚠ setup-schema partiel — on continue"

echo "===== 2/10 setup-articles-schema ====="
node --import tsx setup-articles-schema.ts

echo "===== 3/10 setup-auth-schema ====="
node --import tsx setup-auth-schema.ts

echo "===== 4/10 setup-roles-moderation ====="
node --import tsx setup-roles-moderation.ts

echo "===== 5/10 seed (collectivités, thèmes, démo) ====="
node --import tsx seed.ts

echo "===== 6/10 import RNE (peut être long) ====="
node --import tsx import-rne.ts --download || echo "  ⚠ RNE en échec — on continue"

echo "===== 7/10 conseil municipal LIJ 2026 ====="
node --import tsx update-conseil-2026.ts

echo "===== 8/10 conseil communautaire CCGT 2026 ====="
node --import tsx update-ccgt-2026.ts

echo "===== 9/10 prochaines séances + OJ ====="
node --import tsx import-prochaines-seances.ts
node --import tsx materialize-oj-delibs.ts

echo "===== 10/10 articles WordPress ====="
node --import tsx migrate-wp-articles.ts

echo "===== bonus : déduction sexe ====="
node --import tsx deduce-sexe.ts || true

echo ""
echo "✅ Seed complet — la base devrait contenir :"
echo "  - 16 collectivités (LIJ + CCGT + canton + 13 communes)"
echo "  - 41 engagements de campagne"
echo "  - 170+ élus (RNE) dont 29 conseil LIJ + 37 conseil CCGT"
echo "  - 14 délibérations (PV CCGT 2026-04-07)"
echo "  - 25 délibérations 'à venir' (OJ CM 2026-04-16)"
echo "  - 7 séances (1 passée + 6 à venir)"
echo "  - 15 articles blog migrés de WordPress"

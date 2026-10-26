FROM node:22-alpine AS build
WORKDIR /app
ARG PUBLIC_DIRECTUS_URL
ENV PUBLIC_DIRECTUS_URL=$PUBLIC_DIRECTUS_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
# npm/npx/corepack ne servent qu'au build : on les retire de l'image d'exécution
# (leurs dépendances embarquées remontent des failles au scan de sécurité).
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
ENV HOST=0.0.0.0
ENV PORT=3333
EXPOSE 3333
CMD ["node", "dist/server/entry.mjs"]

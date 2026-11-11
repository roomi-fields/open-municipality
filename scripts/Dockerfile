FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine
# npm/npx/corepack ne servent qu'au build : on les retire de l'image d'exécution
# (leurs dépendances embarquées remontent des failles au scan de sécurité).
RUN rm -rf /usr/local/lib/node_modules /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY . .

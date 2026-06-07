FROM node:22-alpine AS build
WORKDIR /app
ARG PUBLIC_DIRECTUS_URL
ENV PUBLIC_DIRECTUS_URL=$PUBLIC_DIRECTUS_URL
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
ENV HOST=0.0.0.0
ENV PORT=3333
EXPOSE 3333
CMD ["node", "dist/server/entry.mjs"]

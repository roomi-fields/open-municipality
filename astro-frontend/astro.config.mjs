import { defineConfig } from 'astro/config'
import react from '@astrojs/react'
import node from '@astrojs/node'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  output: 'server',
  adapter: node({ mode: 'standalone' }),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
  },
  server: { port: 3333 },
  // Astro 4+ refuse les POST cross-origin par défaut. Derrière un reverse proxy
  // (Traefik/Caddy/nginx), l'Origin = domaine public mais request.url = localhost,
  // ce qui fait échouer les form POST (logout, etc.). On désactive le check :
  // l'auth reste protégée par cookies httpOnly + SameSite=Lax.
  security: { checkOrigin: false },
})

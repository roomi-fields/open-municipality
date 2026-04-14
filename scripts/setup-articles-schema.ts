/**
 * Crée la collection `articles` (blog) dans Directus.
 */
import { login, api } from './lib/directus'

async function main() {
  await login()

  // Vérifier si la collection existe déjà
  try {
    await api('GET', '/collections/articles')
    console.log('⚠  Collection "articles" existe déjà — skip création')
  } catch {
    console.log('📦 Création de la collection articles…')
    await api('POST', '/collections', {
      collection: 'articles',
      meta: {
        icon: 'article',
        note: 'Articles du blog',
        display_template: '{{title}}',
        sort_field: 'date_publication',
      },
      schema: {},
    })
  }

  const fields = [
    { field: 'title', type: 'string', schema: { is_nullable: false }, meta: { interface: 'input', required: true, width: 'full' } },
    { field: 'slug', type: 'string', schema: { is_unique: true, is_nullable: false }, meta: { interface: 'input', required: true, width: 'full', note: 'URL-friendly (ex: mon-article)' } },
    { field: 'excerpt', type: 'text', schema: { is_nullable: true }, meta: { interface: 'input-multiline', note: 'Résumé court (2-3 lignes)' } },
    { field: 'content', type: 'text', schema: { is_nullable: true }, meta: { interface: 'input-rich-text-html', note: 'Corps de l\'article' } },
    { field: 'date_publication', type: 'timestamp', schema: { is_nullable: false }, meta: { interface: 'datetime', required: true, width: 'half' } },
    { field: 'author', type: 'string', schema: { is_nullable: true }, meta: { interface: 'input', width: 'half' } },
    { field: 'image_url', type: 'string', schema: { is_nullable: true }, meta: { interface: 'input', note: 'URL d\'image d\'illustration (optionnel)' } },
    { field: 'statut', type: 'string', schema: { is_nullable: false, default_value: 'brouillon' }, meta: {
        interface: 'select-dropdown',
        options: { choices: [{ text: 'Publié', value: 'publie' }, { text: 'Brouillon', value: 'brouillon' }] },
        required: true,
        width: 'half',
    } },
    { field: 'source_url', type: 'string', schema: { is_nullable: true }, meta: { interface: 'input', note: 'URL source d\'origine (pour archives migrées)' } },
  ]

  for (const f of fields) {
    try {
      await api('GET', `/fields/articles/${f.field}`)
      console.log(`  ⏭  ${f.field} existe`)
    } catch {
      await api('POST', '/fields/articles', f)
      console.log(`  ✅ ${f.field} créé`)
    }
  }

  // Autoriser lecture publique des articles publiés
  try {
    const roles = await api('GET', '/roles?filter[name][_eq]=Public')
    const publicRoleId = roles.data?.[0]?.id
    if (publicRoleId) {
      const perms = await api('GET', `/permissions?filter[collection][_eq]=articles&filter[role][_eq]=${publicRoleId}`)
      if (!perms.data?.length) {
        await api('POST', '/permissions', {
          role: publicRoleId,
          collection: 'articles',
          action: 'read',
          permissions: { statut: { _eq: 'publie' } },
          fields: '*',
        })
        console.log('  🔓 Permission publique (lecture articles publiés) ajoutée')
      }
    }
  } catch (e: any) { console.log('  ⚠ Permissions:', e.message) }

  console.log('\n✅ Schéma articles prêt')
}

main().catch(err => { console.error('❌', err.message); process.exit(1) })

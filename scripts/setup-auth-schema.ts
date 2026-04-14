/**
 * Crée les collections `citoyens` et `magic_tokens` pour l'auth magic-link.
 */
import { login, api } from './lib/directus'

const PUBLIC_POLICY = 'abf8a154-5b1c-4a46-ac9c-7300570f4f17'

async function createCollection(name: string, fields: any[], opts: any = {}) {
  try {
    await api('POST', '/collections', {
      collection: name,
      meta: { icon: opts.icon || 'folder', note: opts.note || '', sort_field: opts.sort_field || null },
      schema: { name },
      fields: [
        { field: 'id', type: 'uuid', schema: { is_primary_key: true, has_auto_increment: false }, meta: { hidden: true, readonly: true, interface: 'input', special: ['uuid'] } },
        ...fields,
      ],
    })
    console.log(`✅ ${name} créée`)
  } catch (e: any) {
    if (e.message?.includes('already exists') || e.message?.includes('existe')) {
      console.log(`⏭  ${name} existe déjà`)
    } else {
      console.log(`❌ ${name}:`, e.message)
    }
  }
}

async function main() {
  await login()

  await createCollection('citoyens', [
    { field: 'email', type: 'string', schema: { is_unique: true, is_nullable: false }, meta: { interface: 'input', required: true, width: 'full' } },
    { field: 'pseudo', type: 'string', schema: { is_unique: true, is_nullable: false }, meta: { interface: 'input', required: true, width: 'half' } },
    { field: 'prenom', type: 'string', schema: {}, meta: { interface: 'input', width: 'half' } },
    { field: 'confirmed', type: 'boolean', schema: { default_value: false }, meta: { interface: 'boolean', width: 'half' } },
    { field: 'rgpd_accepte', type: 'boolean', schema: { default_value: false }, meta: { interface: 'boolean', width: 'half' } },
    { field: 'notif_cm', type: 'boolean', schema: { default_value: false }, meta: { interface: 'boolean', width: 'half', note: 'Recevoir les notifications avant chaque conseil municipal' } },
    { field: 'created_at', type: 'timestamp', schema: { default_value: 'CURRENT_TIMESTAMP' }, meta: { interface: 'datetime', readonly: true, width: 'half' } },
  ], { icon: 'person', note: 'Comptes citoyens (auth magic-link)' })

  await createCollection('magic_tokens', [
    { field: 'token', type: 'string', schema: { is_unique: true, is_nullable: false }, meta: { interface: 'input', required: true, width: 'full' } },
    { field: 'email', type: 'string', schema: { is_nullable: false }, meta: { interface: 'input', required: true, width: 'full' } },
    { field: 'pseudo', type: 'string', schema: {}, meta: { interface: 'input', width: 'half', note: 'Pour nouvelle inscription' } },
    { field: 'prenom', type: 'string', schema: {}, meta: { interface: 'input', width: 'half' } },
    { field: 'citoyen', type: 'uuid', schema: {}, meta: { interface: 'input', width: 'full', note: 'Si citoyen existant (relogin)' } },
    { field: 'expires_at', type: 'timestamp', schema: { is_nullable: false }, meta: { interface: 'datetime', required: true, width: 'half' } },
    { field: 'used', type: 'boolean', schema: { default_value: false }, meta: { interface: 'boolean', width: 'half' } },
    { field: 'created_at', type: 'timestamp', schema: { default_value: 'CURRENT_TIMESTAMP' }, meta: { interface: 'datetime', readonly: true, width: 'half' } },
  ], { icon: 'key', note: 'Tokens magic-link (15 min de validité)' })

  // Permission publique : uniquement POST sur magic_tokens et citoyens (via endpoints Astro côté serveur on utilise un token admin)
  // Pas de permission publique sur citoyens/magic_tokens — accès uniquement via endpoints Astro authentifiés

  // Permission votes_citoyens : POST public (avec validation de l'identité via cookie côté Astro)
  try {
    const existingVote = await api('GET', `/permissions?filter[collection][_eq]=votes_citoyens&filter[policy][_eq]=${PUBLIC_POLICY}&filter[action][_eq]=create`)
    if (!existingVote.data?.length) {
      await api('POST', '/permissions', {
        policy: PUBLIC_POLICY,
        collection: 'votes_citoyens',
        action: 'create',
        permissions: null,
        fields: ['*'],
      })
      console.log('✅ Permission public:create sur votes_citoyens')
    }
  } catch (e: any) { console.log('⚠ votes_citoyens perm:', e.message) }

  console.log('\n✅ Schéma auth prêt')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })

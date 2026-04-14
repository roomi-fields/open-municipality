/**
 * Ajoute le rôle (citoyen/moderateur/admin) aux citoyens + collection
 * `commentaire_votes` pour les pouces 👍👎 + permissions associées.
 * Crée aussi le compte admin Roomi (roomi@liance.art).
 */
import { login, api, getItems, createItem, updateItem } from './lib/directus'

const PUBLIC_POLICY = 'abf8a154-5b1c-4a46-ac9c-7300570f4f17'

async function ensureField(collection: string, field: any) {
  try { await api('GET', `/fields/${collection}/${field.field}`); return false }
  catch { await api('POST', `/fields/${collection}`, field); return true }
}

async function ensureCollection(name: string, opts: any, fields: any[]) {
  try { await api('GET', `/collections/${name}`); return false }
  catch {
    await api('POST', '/collections', {
      collection: name,
      meta: opts,
      schema: { name },
      fields: [
        { field: 'id', type: 'integer', schema: { is_primary_key: true, has_auto_increment: true }, meta: { hidden: true, readonly: true, interface: 'input' } },
        ...fields,
      ],
    })
    return true
  }
}

async function ensurePerm(collection: string, action: string, payload: any) {
  const r = await api('GET', `/permissions?filter[collection][_eq]=${collection}&filter[policy][_eq]=${PUBLIC_POLICY}&filter[action][_eq]=${action}`)
  if (r.data?.length) return false
  await api('POST', '/permissions', { policy: PUBLIC_POLICY, collection, action, ...payload })
  return true
}

async function main() {
  await login()

  console.log('🔧 Ajout du champ role aux citoyens...')
  const created = await ensureField('citoyens', {
    field: 'role',
    type: 'string',
    schema: { is_nullable: false, default_value: 'citoyen' },
    meta: {
      interface: 'select-dropdown',
      options: { choices: [
        { text: 'Citoyen', value: 'citoyen' },
        { text: 'Modérateur', value: 'moderateur' },
        { text: 'Administrateur', value: 'admin' },
      ] },
      width: 'half',
    },
  })
  console.log(created ? '  ✅ champ ajouté' : '  ⏭ déjà existant')

  console.log('\n🔧 Création collection commentaire_votes...')
  const cCreated = await ensureCollection('commentaire_votes',
    { icon: 'thumb_up', note: '👍👎 sur les commentaires (1 vote par citoyen par commentaire)' },
    [
      { field: 'commentaire', type: 'integer', schema: { is_nullable: false }, meta: { interface: 'input', required: true } },
      { field: 'auteur', type: 'uuid', schema: { is_nullable: false }, meta: { interface: 'input', required: true } },
      { field: 'value', type: 'integer', schema: { is_nullable: false }, meta: {
        interface: 'select-dropdown',
        options: { choices: [{ text: 'Pouce haut', value: 1 }, { text: 'Pouce bas', value: -1 }] },
        required: true,
      } },
      { field: 'created_at', type: 'timestamp', schema: { default_value: 'CURRENT_TIMESTAMP' }, meta: { readonly: true } },
    ],
  )
  console.log(cCreated ? '  ✅ collection créée' : '  ⏭ déjà existante')

  console.log('\n🔓 Permissions publiques...')
  const p1 = await ensurePerm('commentaire_votes', 'read', { permissions: null, fields: ['*'] })
  console.log(p1 ? '  ✅ commentaire_votes:read' : '  ⏭ commentaire_votes:read déjà OK')
  const p2 = await ensurePerm('citoyens', 'read', { permissions: null, fields: ['id', 'pseudo'] })
  console.log(p2 ? '  ✅ citoyens:read (pseudo public)' : '  ⏭ citoyens:read déjà OK')

  console.log('\n👤 Compte admin Roomi...')
  const ex = await getItems('citoyens', `filter[email][_eq]=roomi@liance.art&limit=1`)
  if (ex[0]) {
    await updateItem('citoyens', ex[0].id, { role: 'admin', confirmed: true, pseudo: ex[0].pseudo || 'Roomi' })
    console.log(`  ✏️  ${ex[0].id} → admin`)
  } else {
    const c = await createItem('citoyens', {
      email: 'roomi@liance.art',
      pseudo: 'Roomi',
      role: 'admin',
      confirmed: true,
      rgpd_accepte: true,
    })
    console.log(`  ➕ ${c?.id} créé en admin`)
  }

  console.log('\n✅ Setup terminé')
}

main().catch(e => { console.error('❌', e.message); process.exit(1) })

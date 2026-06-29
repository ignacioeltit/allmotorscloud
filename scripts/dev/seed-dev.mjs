// scripts/dev/seed-dev.mjs
//
// Seed de desarrollo LOCAL. Crea lo mínimo para ejecutar el Vertical Slice con sesión real:
//   1. Una organización demo.
//   2. Un usuario admin en Supabase Auth con app_metadata { org_id, role: 'admin' }.
//   3. La fila public.usuarios correspondiente (id = auth.uid()).
//   4. Tipos de evento para poder registrar eventos.
//
// Usa SUPABASE_SERVICE_ROLE_KEY: SOLO para bootstrap local. NUNCA en la app.
// Es idempotente: puede ejecutarse varias veces sin duplicar datos.
//
// Uso (Node 20+):
//   node --env-file=.env.local scripts/dev/seed-dev.mjs
//
// Variables opcionales: SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD.

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    'Faltan variables de entorno. Necesarias: NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Ejecuta con: node --env-file=.env.local scripts/dev/seed-dev.mjs',
  )
  process.exit(1)
}

const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@allmotors.local'
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? 'Admin123!'
const ORG_SLUG = 'taller-demo'

const db = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
})

function fail(label, error) {
  console.error(`✗ ${label}:`, error.message ?? error)
  process.exit(1)
}

async function main() {
  // 1) Organización (idempotente por slug)
  let orgId
  {
    const { data: existing } = await db
      .from('organizaciones')
      .select('id')
      .eq('slug', ORG_SLUG)
      .maybeSingle()

    if (existing) {
      orgId = existing.id
    } else {
      const { data, error } = await db
        .from('organizaciones')
        .insert({ slug: ORG_SLUG, rut: '76.123.456-7', nombre: 'Taller Demo' })
        .select('id')
        .single()
      if (error) fail('crear organización', error)
      orgId = data.id
    }
    console.log('· organización:', orgId)
  }

  // 2) rol admin
  const { data: rolAdmin, error: rolErr } = await db
    .from('roles')
    .select('id')
    .eq('nombre', 'admin')
    .single()
  if (rolErr) fail('buscar rol admin', rolErr)

  // 3) Usuario admin en Auth (idempotente por email)
  let userId
  {
    const { data: list, error: listErr } = await db.auth.admin.listUsers({ perPage: 200 })
    if (listErr) fail('listar usuarios', listErr)
    const existing = list.users.find((u) => u.email === ADMIN_EMAIL)

    const appMetadata = { org_id: orgId, role: 'admin' }
    if (existing) {
      userId = existing.id
      const { error } = await db.auth.admin.updateUserById(userId, {
        password: ADMIN_PASSWORD,
        app_metadata: appMetadata,
      })
      if (error) fail('actualizar usuario auth', error)
    } else {
      const { data, error } = await db.auth.admin.createUser({
        email: ADMIN_EMAIL,
        password: ADMIN_PASSWORD,
        email_confirm: true,
        app_metadata: appMetadata,
      })
      if (error) fail('crear usuario auth', error)
      userId = data.user.id
    }
    console.log('· usuario auth:', userId)
  }

  // 4) Fila public.usuarios (id = auth.uid())
  {
    const { error } = await db
      .from('usuarios')
      .upsert(
        {
          id: userId,
          org_id: orgId,
          rol_id: rolAdmin.id,
          nombre: 'Admin Demo',
          email: ADMIN_EMAIL,
        },
        { onConflict: 'id' },
      )
    if (error) fail('upsert public.usuarios', error)
  }

  // 5) tipos_evento (idempotente por org_id + slug)
  const tipos = [
    { slug: 'recepcion', nombre: 'Recepción', categoria: 'inspeccion' },
    { slug: 'diagnostico', nombre: 'Diagnóstico', categoria: 'reparacion' },
    { slug: 'mantencion', nombre: 'Mantención', categoria: 'mantencion' },
    { slug: 'nota-interna', nombre: 'Nota interna', categoria: 'documentacion' },
  ]
  for (const t of tipos) {
    const { data: ex } = await db
      .from('tipos_evento')
      .select('id')
      .eq('org_id', orgId)
      .eq('slug', t.slug)
      .maybeSingle()
    if (!ex) {
      const { error } = await db.from('tipos_evento').insert({
        org_id: orgId,
        slug: t.slug,
        nombre: t.nombre,
        categoria: t.categoria,
        creado_por: userId,
      })
      if (error) fail(`crear tipo_evento ${t.slug}`, error)
    }
  }
  console.log('· tipos_evento:', tipos.length, 'asegurados')

  console.log('\n✓ Seed completo.')
  console.log(`  Login → ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`)
  console.log(`  org_id → ${orgId}`)
}

main().catch((e) => fail('seed', e))

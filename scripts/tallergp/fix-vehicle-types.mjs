#!/usr/bin/env node
// Corrige vehiculos.tipo para los importados desde TallerGP (todos quedaron 'auto').
// Infiere el tipo desde el modelo/marca con listas de tokens conocidos del parque real
// del taller. Solo toca vehículos con origen_tallergp_id (importados) que sigan en 'auto';
// lo que el taller ya haya corregido a mano no se pisa.
//
// Uso:
//   dry-run: node --env-file=apps/web/.env.local scripts/tallergp/fix-vehicle-types.mjs
//   apply:   node --env-file=apps/web/.env.local scripts/tallergp/fix-vehicle-types.mjs --apply

import { clasificar } from './lib/vehicle-type-classifier.mjs'

const APPLY = process.argv.includes('--apply')
const BATCH_SIZE = 200

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\nERROR: Ejecutar con: node --env-file=apps/web/.env.local ...\n')
  process.exit(1)
}

// ─── Supabase REST ────────────────────────────────────────────────────────────

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`)
  return res.json()
}

async function sbPatch(path, body) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'PATCH',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}: ${(await res.text()).slice(0, 300)}`)
}

async function fetchVehiculosImportados() {
  const all = []
  let offset = 0
  const limit = 1000
  while (true) {
    const rows = await sbGet(
      `/vehiculos?select=id,patente,marca,modelo,tipo` +
      `&origen_tallergp_id=not.is.null&tipo=eq.auto&eliminado_en=is.null` +
      `&order=id.asc&limit=${limit}&offset=${offset}`
    )
    if (!rows || rows.length === 0) break
    all.push(...rows)
    if (rows.length < limit) break
    offset += limit
  }
  return all
}

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔧 Corrección de tipo de vehículo${APPLY ? ' [APPLY]' : ' [DRY-RUN]'}`)

  const vehiculos = await fetchVehiculosImportados()
  console.log(`  Vehículos importados aún en tipo 'auto': ${vehiculos.length}`)

  const porTipo = { camioneta: [], furgon: [], camion: [], moto: [] }
  let sinEvidencia = 0

  for (const v of vehiculos) {
    const tipo = clasificar(v.marca, v.modelo)
    if (tipo) porTipo[tipo].push(v)
    else sinEvidencia++
  }

  const sep = '─'.repeat(56)
  console.log('\n' + sep)
  for (const [tipo, lista] of Object.entries(porTipo)) {
    console.log(`  ${tipo.padEnd(10)} ${String(lista.length).padStart(5)}`)
  }
  console.log(`  ${'(quedan auto)'.padEnd(10)} ${String(sinEvidencia).padStart(5)}`)
  console.log(sep)

  for (const [tipo, lista] of Object.entries(porTipo)) {
    if (lista.length === 0) continue
    console.log(`\n  Muestra → ${tipo}:`)
    for (const v of lista.slice(0, 8)) {
      console.log(`    ${v.patente.padEnd(10)} ${v.marca} ${v.modelo}`)
    }
    if (lista.length > 8) console.log(`    … y ${lista.length - 8} más`)
  }

  if (!APPLY) {
    console.log('\n  Para aplicar:')
    console.log('  node --env-file=apps/web/.env.local scripts/tallergp/fix-vehicle-types.mjs --apply\n')
    return
  }

  console.log('\n🚀 Aplicando…')
  for (const [tipo, lista] of Object.entries(porTipo)) {
    if (lista.length === 0) continue
    for (let i = 0; i < lista.length; i += BATCH_SIZE) {
      const batch = lista.slice(i, i + BATCH_SIZE)
      const ids = batch.map((v) => v.id).join(',')
      await sbPatch(`/vehiculos?id=in.(${ids})`, { tipo })
      process.stdout.write(`  ${tipo}: ${Math.min(i + BATCH_SIZE, lista.length)}/${lista.length}…\r`)
      await sleep(120)
    }
    console.log(`  ${tipo}: ${lista.length} actualizados${' '.repeat(16)}`)
  }
  console.log('\n✅ Corrección aplicada.\n')
}

main().catch((e) => {
  console.error('\n❌ Error fatal:', e.message)
  process.exit(1)
})

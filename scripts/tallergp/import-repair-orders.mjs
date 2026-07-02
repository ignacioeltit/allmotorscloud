#!/usr/bin/env node
// Importa OTs históricas respaldadas de TallerGP hacia el modelo de All Motors,
// llamando la RPC fn_importar_ot_historica (transacción atómica por OT).
//
// Uso:
//   node --env-file=apps/web/.env.local scripts/tallergp/import-repair-orders.mjs [--limit=5]
//
// Idempotente: la RPC salta OTs cuyo numero_ot ya existe. Por defecto procesa
// solo las primeras 5 (prueba). Sube --limit para cargar más.

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')
const BACKUP_DIR = join(ROOT, 'migration-toolkit', 'exports', 'backup', 'repair-orders')

const LIMIT = Number(process.argv.find((a) => a.startsWith('--limit='))?.split('=')[1] ?? 5)

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\nERROR: ejecutar con node --env-file=apps/web/.env.local ...\n')
  process.exit(1)
}

async function sbGet(path) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!r.ok) throw new Error(`GET ${path} → ${r.status}: ${(await r.text()).slice(0, 200)}`)
  return r.json()
}

async function rpc(fn, body) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const txt = await r.text()
  if (!r.ok) throw new Error(`RPC ${fn} → ${r.status}: ${txt.slice(0, 300)}`)
  return JSON.parse(txt)
}

async function main() {
  // Contexto: org y usuario admin (el que creó los registros)
  const [org] = await sbGet('/organizaciones?select=id&limit=1')
  const [usuario] = await sbGet('/usuarios?select=id&eliminado_en=is.null&order=creado_en.asc&limit=1')
  if (!org || !usuario) {
    console.error('No se pudo resolver org/usuario.')
    process.exit(1)
  }

  // OTs respaldadas, ordenadas por número para que las "primeras" sean estables
  const files = readdirSync(BACKUP_DIR).filter((f) => f.endsWith('.json'))
  const ots = files
    .map((f) => JSON.parse(readFileSync(join(BACKUP_DIR, f), 'utf-8')))
    .filter((o) => o.order_number)
    .sort((a, b) => a.order_number.localeCompare(b.order_number, undefined, { numeric: true }))
    .slice(0, LIMIT)

  console.log(`\n🔧 Import OTs históricas → All Motors  (org ${org.id.slice(0, 8)}…, límite ${LIMIT})`)
  console.log(`   Disponibles en respaldo: ${files.length}. Procesando: ${ots.length}\n`)

  const tally = { ok: 0, skipped: 0, sin_vehiculo: 0, otro_error: 0, items: 0 }

  for (const ot of ots) {
    try {
      const res = await rpc('fn_importar_ot_historica', { p_org_id: org.id, p_user_id: usuario.id, p_ot: ot })
      if (res.ok) {
        tally.ok++
        tally.items += res.items ?? 0
        console.log(`  ✓ ${res.numero_ot.padEnd(10)} importada — ${res.items} ítems`)
      } else if (res.skipped) {
        tally.skipped++
        console.log(`  · ${res.numero_ot.padEnd(10)} ya existía (saltada)`)
      } else if (res.error === 'vehiculo_no_encontrado') {
        tally.sin_vehiculo++
        console.log(`  ⚠ ${(res.numero_ot ?? '?').padEnd(10)} vehículo no importado (saltada)`)
      } else {
        tally.otro_error++
        console.log(`  ✗ ${(res.numero_ot ?? '?').padEnd(10)} ${res.error}`)
      }
    } catch (e) {
      tally.otro_error++
      console.log(`  ✗ ${ot.order_number.padEnd(10)} ${e.message}`)
    }
  }

  const sep = '─'.repeat(50)
  console.log('\n' + sep)
  console.log(`  Importadas:            ${tally.ok}  (${tally.items} ítems)`)
  console.log(`  Ya existían:           ${tally.skipped}`)
  console.log(`  Sin vehículo:          ${tally.sin_vehiculo}`)
  console.log(`  Otros errores:         ${tally.otro_error}`)
  console.log(sep + '\n')
}

main().catch((e) => {
  console.error('\n❌ Error fatal:', e.message)
  process.exit(1)
})

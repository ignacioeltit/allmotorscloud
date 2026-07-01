#!/usr/bin/env node
// Importa clientes y vehículos desde el respaldo local de TallerGP
// (migration-toolkit/exports/backup/{customers,vehicles-list}/) hacia
// las tablas clientes / vehiculos / propietarios_vehiculo.
//
// Uso:
//   dry-run: node --env-file=apps/web/.env.local scripts/tallergp/import-customers-vehicles.mjs
//   apply:   node --env-file=apps/web/.env.local scripts/tallergp/import-customers-vehicles.mjs --apply
//
// Reglas:
//   - Resumible: usa origen_tallergp_id para no duplicar si se corre más de una vez
//   - Nunca borra, nunca pisa registros ya existentes que no tengan origen_tallergp_id
//   - Vehículos con patente duplicada en TallerGP (mismo VIN, mismo cliente) → se
//     importa solo el primero, el resto se reporta como omitido
//   - marca/modelo faltantes → 'SIN INFORMACION' (NOT NULL en el schema)
//   - tipo vehículo: sin dato real en TallerGP → default 'auto', a revisar a mano
//   - año del vehículo: no viene en el listado, se completará después desde las OTs

import { readFileSync, readdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')

const CUSTOMERS_DIR = join(ROOT, 'migration-toolkit', 'exports', 'backup', 'customers')
const VEHICLES_DIR = join(ROOT, 'migration-toolkit', 'exports', 'backup', 'vehicles-list')
const BATCH_SIZE = 200
const APPLY = process.argv.includes('--apply')

// ─── Validar env ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\nERROR: Faltan variables de entorno requeridas.')
  console.error('  Ejecutar con: node --env-file=apps/web/.env.local ...')
  console.error('  Requeridas: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n')
  process.exit(1)
}

// ─── Supabase REST helpers ─────────────────────────────────────────────────────

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`GET ${path} → ${res.status}: ${txt.slice(0, 300)}`)
  }
  return res.json()
}

async function sbPost(path, body, extraHeaders = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    method: 'POST',
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`POST ${path} → ${res.status}: ${txt.slice(0, 400)}`)
  }
  return null
}

async function fetchAllPaginated(pathBase, params) {
  const all = []
  let offset = 0
  const limit = 1000
  while (true) {
    const rows = await sbGet(`${pathBase}?${params}&limit=${limit}&offset=${offset}`)
    if (!rows || rows.length === 0) break
    all.push(...rows)
    if (rows.length < limit) break
    offset += limit
  }
  return all
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

// ─── Auto-discover org y usuario (mismo patrón que sync-materials) ────────────

async function discoverContext() {
  let orgId = null
  let userId = null

  try {
    const rows = await sbGet('/usuarios?select=id,org_id&eliminado_en=is.null&order=creado_en.asc&limit=1')
    if (rows?.length > 0 && rows[0].org_id) {
      orgId = rows[0].org_id
      userId = rows[0].id
    }
  } catch { /* ignorar */ }

  if (!orgId || !userId) {
    console.error('\nERROR: No se pudo determinar org_id ni usuario.')
    process.exit(1)
  }

  return { orgId, userId }
}

// ─── Cargar respaldo local ─────────────────────────────────────────────────────

function loadPages(dir) {
  const files = readdirSync(dir).filter((f) => f.startsWith('page-') && f.endsWith('.json')).sort()
  const rows = []
  for (const f of files) {
    const parsed = JSON.parse(readFileSync(join(dir, f), 'utf-8'))
    rows.push(...parsed.data)
  }
  return rows
}

// ─── Mapeo clientes ────────────────────────────────────────────────────────────

function buildCliente(c, orgId, userId) {
  const esEmpresa = String(c.client_type) === '2'
  const nombre = esEmpresa
    ? String(c.name ?? '').trim()
    : [c.name, c.lastname, c.surname].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()

  return {
    org_id: orgId,
    tipo: esEmpresa ? 'empresa' : 'persona_natural',
    nombre,
    rut: c.vat_number ? String(c.vat_number).trim() : null,
    telefono: c.mobile || c.phone || null,
    email: c.mail || null,
    direccion: [c.address, c.location, c.province].filter(Boolean).join(', ') || null,
    notas: null,
    creado_por: userId,
    origen_tallergp_id: String(c.id),
  }
}

// ─── Mapeo vehículos ───────────────────────────────────────────────────────────

function buildVehiculo(v, orgId, userId) {
  const kms = v.kms != null ? parseInt(v.kms, 10) : null
  return {
    org_id: orgId,
    patente: String(v.plate).trim().toUpperCase(),
    vin: v.vin ? String(v.vin).trim() : null,
    marca: (v.branch ? String(v.branch).trim() : '') || 'SIN INFORMACION',
    modelo: (v.model ? String(v.model).trim() : '') || 'SIN INFORMACION',
    anio: null,
    color: v.color ? String(v.color).trim() : null,
    tipo: 'auto',
    km_actual: Number.isFinite(kms) ? kms : null,
    notas: null,
    creado_por: userId,
    origen_tallergp_id: String(v.id),
    _client_tallergp_id: v.client_id ? String(v.client_id) : null,
  }
}

// ─── Planificación ─────────────────────────────────────────────────────────────

function dedupeVehiculosPorPatente(vehiculos) {
  const byPatente = new Map()
  const omitidos = []
  for (const v of vehiculos) {
    if (byPatente.has(v.patente)) {
      omitidos.push(v)
      continue
    }
    byPatente.set(v.patente, v)
  }
  return { unicos: [...byPatente.values()], omitidos }
}

// ─── Ejecución en lotes ─────────────────────────────────────────────────────────

async function insertBatched(path, records, label) {
  let done = 0
  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE)
    process.stdout.write(`  Insertando ${label}: ${i + batch.length}/${records.length}…\r`)
    await sbPost(path, batch)
    done += batch.length
    if (i + BATCH_SIZE < records.length) await sleep(150)
  }
  console.log(`  Insertados ${label}: ${done}${' '.repeat(20)}`)
  return done
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄 Import TallerGP → clientes/vehiculos${APPLY ? ' [APPLY]' : ' [DRY-RUN]'}`)

  const { orgId, userId } = await discoverContext()
  console.log(`  🏢 Org:  ${orgId}`)
  console.log(`  👤 User: ${userId}`)

  // ── Clientes ──
  const clientesRaw = loadPages(CUSTOMERS_DIR)
  console.log(`  📂 Clientes leídos del respaldo: ${clientesRaw.length}`)

  const clientesExistentes = await fetchAllPaginated(
    '/clientes',
    `select=origen_tallergp_id,rut&org_id=eq.${orgId}&origen_tallergp_id=not.is.null`
  )
  const clientesYaImportados = new Set(clientesExistentes.map((c) => c.origen_tallergp_id))
  const rutsYaEnUso = new Set(clientesExistentes.filter((c) => c.rut).map((c) => c.rut))

  const clientesRecords = clientesRaw
    .map((c) => buildCliente(c, orgId, userId))
    .filter((c) => c.nombre.length > 0)
  const clientesSinNombre = clientesRaw.length - clientesRecords.length
  const clientesACrear = clientesRecords.filter((c) => !clientesYaImportados.has(c.origen_tallergp_id))

  // RUT duplicado en TallerGP (mismo RUT, distinto customer_number) → el schema
  // exige RUT único por org entre clientes activos. Se conserva el primero,
  // se anula el RUT en los siguientes y se deja marcado en notas para revisión.
  let rutsDuplicados = 0
  for (const c of clientesACrear) {
    if (!c.rut) continue
    if (rutsYaEnUso.has(c.rut)) {
      c.notas = `RUT duplicado en TallerGP (${c.rut}) — revisar y fusionar con el cliente original si corresponde.`
      c.rut = null
      rutsDuplicados++
    } else {
      rutsYaEnUso.add(c.rut)
    }
  }

  // ── Vehículos ──
  const vehiculosRaw = loadPages(VEHICLES_DIR)
  console.log(`  📂 Vehículos leídos del respaldo: ${vehiculosRaw.length}`)

  const vehiculosExistentes = await fetchAllPaginated(
    '/vehiculos',
    `select=origen_tallergp_id&org_id=eq.${orgId}&origen_tallergp_id=not.is.null`
  )
  const vehiculosYaImportados = new Set(vehiculosExistentes.map((v) => v.origen_tallergp_id))

  const vehiculosRecords = vehiculosRaw.map((v) => buildVehiculo(v, orgId, userId))
  const { unicos: vehiculosUnicos, omitidos: vehiculosDuplicados } = dedupeVehiculosPorPatente(vehiculosRecords)
  const vehiculosACrear = vehiculosUnicos.filter((v) => !vehiculosYaImportados.has(v.origen_tallergp_id))

  // ── Reporte ──
  const sep = '─'.repeat(58)
  const sep2 = '═'.repeat(58)
  console.log('\n' + sep2)
  console.log(`  IMPORT TALLERGP${APPLY ? ' — RESULTADO APPLY' : ' — DRY-RUN'}`)
  console.log(sep2)
  console.log('  CLIENTES')
  console.log(`    Leídos:                    ${String(clientesRaw.length).padStart(5)}`)
  console.log(`    Sin nombre (omitidos):     ${String(clientesSinNombre).padStart(5)}`)
  console.log(`    Ya importados antes:       ${String(clientesRecords.length - clientesACrear.length).padStart(5)}`)
  console.log(`    RUT duplicado (rut→null):  ${String(rutsDuplicados).padStart(5)}`)
  console.log(`    Se ${APPLY ? 'CREARON' : 'CREARÍAN'}:               ${String(clientesACrear.length).padStart(5)}`)
  console.log(sep)
  console.log('  VEHÍCULOS')
  console.log(`    Leídos:                    ${String(vehiculosRaw.length).padStart(5)}`)
  console.log(`    Patente duplicada (omit.): ${String(vehiculosDuplicados.length).padStart(5)}`)
  console.log(`    Ya importados antes:       ${String(vehiculosUnicos.length - vehiculosACrear.length).padStart(5)}`)
  console.log(`    Se ${APPLY ? 'CREARON' : 'CREARÍAN'}:               ${String(vehiculosACrear.length).padStart(5)}`)
  console.log(sep2)

  if (vehiculosDuplicados.length > 0) {
    console.log(`\n⚠  Patentes duplicadas omitidas:`)
    for (const v of vehiculosDuplicados) console.log(`   - ${v.patente} (origen ${v.origen_tallergp_id})`)
  }

  if (!APPLY) {
    console.log('\n  Para ejecutar la importación real:\n')
    console.log('  node --env-file=apps/web/.env.local \\')
    console.log('    scripts/tallergp/import-customers-vehicles.mjs --apply\n')
    return
  }

  // ── Insertar clientes ──
  console.log('\n🚀 Ejecutando importación…')
  if (clientesACrear.length > 0) {
    await insertBatched('/clientes', clientesACrear, 'clientes')
  }

  // ── Insertar vehículos ──
  if (vehiculosACrear.length > 0) {
    await insertBatched(
      '/vehiculos',
      vehiculosACrear.map(({ _client_tallergp_id, ...rest }) => rest),
      'vehículos'
    )
  }

  // ── Enlazar propietarios_vehiculo ──
  console.log('\n🔗 Enlazando propietarios (cliente ↔ vehículo)…')

  const clientesActuales = await fetchAllPaginated(
    '/clientes',
    `select=id,origen_tallergp_id&org_id=eq.${orgId}&origen_tallergp_id=not.is.null`
  )
  const clienteIdPorOrigen = new Map(clientesActuales.map((c) => [c.origen_tallergp_id, c.id]))

  const vehiculosActuales = await fetchAllPaginated(
    '/vehiculos',
    `select=id,origen_tallergp_id&org_id=eq.${orgId}&origen_tallergp_id=not.is.null`
  )
  const vehiculoIdPorOrigen = new Map(vehiculosActuales.map((v) => [v.origen_tallergp_id, v.id]))

  const propietariosExistentes = await fetchAllPaginated(
    '/propietarios_vehiculo',
    `select=vehiculo_id&org_id=eq.${orgId}&fecha_fin=is.null`
  )
  const vehiculosConDueno = new Set(propietariosExistentes.map((p) => p.vehiculo_id))

  const hoy = new Date().toISOString().slice(0, 10)
  const propietariosACrear = []
  let sinCliente = 0

  for (const v of vehiculosUnicos) {
    if (!v._client_tallergp_id) continue
    const vehiculoId = vehiculoIdPorOrigen.get(v.origen_tallergp_id)
    const clienteId = clienteIdPorOrigen.get(v._client_tallergp_id)
    if (!vehiculoId || !clienteId) { sinCliente++; continue }
    if (vehiculosConDueno.has(vehiculoId)) continue // ya tiene dueño activo

    propietariosACrear.push({
      vehiculo_id: vehiculoId,
      cliente_id: clienteId,
      org_id: orgId,
      fecha_inicio: hoy,
      fecha_fin: null,
      creado_por: userId,
    })
  }

  console.log(`  Relaciones a crear: ${propietariosACrear.length} (sin cliente resoluble: ${sinCliente})`)
  if (propietariosACrear.length > 0) {
    await insertBatched('/propietarios_vehiculo', propietariosACrear, 'propietarios_vehiculo')
  }

  console.log('\n' + sep2)
  console.log('  ✅ IMPORTACIÓN COMPLETADA')
  console.log(sep2 + '\n')
}

main().catch((e) => {
  console.error('\n❌ Error fatal:', e.message)
  process.exit(1)
})

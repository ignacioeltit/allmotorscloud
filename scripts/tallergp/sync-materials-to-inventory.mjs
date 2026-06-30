#!/usr/bin/env node
// Importa materiales de TallerGP (vía materials-normalized.json) hacia tabla repuestos.
//
// Uso:
//   dry-run: node --env-file=apps/web/.env.local scripts/tallergp/sync-materials-to-inventory.mjs
//   apply:   node --env-file=apps/web/.env.local scripts/tallergp/sync-materials-to-inventory.mjs --apply
//
// Reglas:
//   - Precio estimado: precioVenta null en archivo normalizado → precio_venta = costo × 1.40
//   - NUNCA tocar stock_actual en registros existentes
//   - Nunca borrar, nunca duplicar, nunca cambiar org_id
//   - Stock negativo de TallerGP → clampear a 0 en INSERT
//   - Precio estimado marcado en campo descripcion con [PRECIO ESTIMADO]

import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..', '..')

// ─── Constantes ───────────────────────────────────────────────────────────────

const PRECIO_ESTIMADO_MARKER = '[PRECIO ESTIMADO]'
const PRECIO_ESTIMADO_NOTE =
  '[PRECIO ESTIMADO] Precio de venta calculado con margen 40% sobre costo al importar desde TallerGP. Revisar antes de aprobar presupuesto.'

const NORMALIZED_FILE = join(ROOT, 'tmp', 'tallergp', 'materials-audit', 'materials-normalized.json')
const BATCH_SIZE = 200
const APPLY = process.argv.includes('--apply')

// ─── Validar env ──────────────────────────────────────────────────────────────

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('\nERROR: Faltan variables de entorno requeridas.')
  console.error('  Ejecutar con: node --env-file=apps/web/.env.local ...')
  console.error('  Requeridas: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY\n')
  process.exit(1)
}

// ─── Supabase REST helpers ─────────────────────────────────────────────────────

async function sbGet(path) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1${path}`, {
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
    },
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
      apikey:          SERVICE_KEY,
      Authorization:   `Bearer ${SERVICE_KEY}`,
      'Content-Type':  'application/json',
      Prefer:          'return=minimal',
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

// ─── Auto-discover org y usuario ──────────────────────────────────────────────

async function discoverContext() {
  let orgId   = null
  let userId  = null

  // Intento 1: desde usuarios
  try {
    const rows = await sbGet('/usuarios?select=id,org_id&eliminado_en=is.null&order=creado_en.asc&limit=1')
    if (rows?.length > 0 && rows[0].org_id) {
      orgId  = rows[0].org_id
      userId = rows[0].id
    }
  } catch { /* ignorar */ }

  // Intento 2: desde repuestos existentes (si ya hay inventario)
  if (!orgId) {
    try {
      const rows = await sbGet('/repuestos?select=org_id,creado_por&limit=1')
      if (rows?.length > 0) {
        orgId  = rows[0].org_id
        userId = rows[0].creado_por
      }
    } catch { /* ignorar */ }
  }

  if (!orgId || !userId) {
    console.error('\nERROR: No se pudo determinar org_id ni usuario.')
    console.error('  Asegúrate de que haya al menos un usuario en la base de datos.')
    process.exit(1)
  }

  return { orgId, userId }
}

// ─── Cargar archivo normalizado ───────────────────────────────────────────────

function loadNormalized() {
  let parsed
  try {
    parsed = JSON.parse(readFileSync(NORMALIZED_FILE, 'utf-8'))
  } catch {
    console.error(`\nERROR: No se pudo leer ${NORMALIZED_FILE}`)
    console.error('  Primero correr: node --env-file=migration-toolkit/.env scripts/tallergp/audit-materials.mjs\n')
    process.exit(1)
  }
  if (!Array.isArray(parsed?.items)) {
    console.error('\nERROR: El archivo normalizado no tiene estructura esperada ({ items: [] })\n')
    process.exit(1)
  }
  return parsed.items
}

// ─── Obtener repuestos existentes ─────────────────────────────────────────────

async function fetchExistingRepuestos(orgId) {
  const existing = new Map()  // codigo → { id, stock_actual, creado_por, descripcion }
  let offset = 0
  const limit = 1000

  while (true) {
    const rows = await sbGet(
      `/repuestos?select=id,codigo,stock_actual,creado_por,descripcion` +
      `&org_id=eq.${orgId}&eliminado_en=is.null` +
      `&order=codigo.asc&limit=${limit}&offset=${offset}`
    )
    if (!rows || rows.length === 0) break
    for (const r of rows) existing.set(r.codigo, r)
    if (rows.length < limit) break
    offset += limit
  }

  return existing
}

// ─── Mapeo normalizado → repuesto ─────────────────────────────────────────────

function buildRecord(item, orgId, userId) {
  const costo   = Number(item.costoUnitario) || 0
  const pvpReal = item.precioVenta != null ? Number(item.precioVenta) : 0

  // Usar pvp real si > 0; estimar con ×1.40 solo cuando pvp = 0 o nulo
  let pv = null
  let esEstimado = false
  if (pvpReal > 0) {
    pv         = Math.round(pvpReal)
    esEstimado = false
  } else if (costo > 0) {
    pv         = Math.round(costo * 1.40)
    esEstimado = true
  }

  return {
    org_id:       orgId,
    codigo:       String(item.codigo).trim(),
    nombre:       String(item.nombre).trim(),
    descripcion:  esEstimado ? PRECIO_ESTIMADO_NOTE : null,
    categoria:    item.categoria    ?? null,
    marca:        item.marca        ?? null,
    proveedor:    item.proveedor    ?? null,
    unidad:       item.unidadMedida ?? 'unidad',
    precio_costo: costo > 0 ? costo : null,
    precio_venta: pv,
    stock_minimo: 0,
    activo:       item.activo !== false,
    creado_por:   userId,
  }
}

// ─── Planificar sync ──────────────────────────────────────────────────────────

function planSync(items, existingMap, orgId, userId) {
  const toCreate   = []
  const toUpdate   = []
  const invalid    = []
  const warnings   = []
  let   stockNegCount = 0

  for (const item of items) {
    const codigo = item.codigo != null ? String(item.codigo).trim() : ''
    const nombre = item.nombre != null ? String(item.nombre).trim() : ''

    if (!codigo) { invalid.push({ item, reason: 'Sin código' }); continue }
    if (!nombre) { invalid.push({ item, reason: 'Sin nombre' }); continue }
    if (codigo.length > 100) {
      invalid.push({ item, reason: `Código demasiado largo (${codigo.length} chars)` })
      continue
    }

    const stockRaw = Number(item.stockActual)
    if (stockRaw < 0) {
      stockNegCount++
      warnings.push(`[${codigo}] stock negativo (${stockRaw}) → importado como 0`)
    }

    const costo = Number(item.costoUnitario) || 0
    if (costo === 0) {
      warnings.push(`[${codigo}] sin costo → precio_venta no calculado`)
    }

    const rec = buildRecord(item, orgId, userId)

    if (existingMap.has(codigo)) {
      const existing = existingMap.get(codigo)

      // Campos permitidos para UPDATE — NUNCA stock_actual, NUNCA org_id (solo como filtro)
      // creado_por: mantener del registro existente para que el upsert no viole NOT NULL
      const { stock_actual: _sa, ...updateFields } = rec
      void _sa
      updateFields.creado_por = existing.creado_por

      // No sobrescribir descripcion si el usuario ya tiene una personalizada
      if (existing.descripcion && !existing.descripcion.includes(PRECIO_ESTIMADO_MARKER)) {
        delete updateFields.descripcion
      }

      toUpdate.push({ codigo, fields: updateFields })
    } else {
      toCreate.push({
        ...rec,
        stock_actual: Math.max(0, stockRaw),
      })
    }
  }

  return { toCreate, toUpdate, invalid, warnings, stockNegCount }
}

// ─── Reporte dry-run ──────────────────────────────────────────────────────────

function printReport(items, toCreate, toUpdate, invalid, warnings, stockNegCount) {
  const total      = items.length
  const validTotal = total - invalid.length

  // Conteos de precio por origen (sobre todas las filas válidas procesadas)
  const allRecs = [
    ...toCreate.map((r) => ({ precio_venta: r.precio_venta, esEst: !!r.descripcion?.includes(PRECIO_ESTIMADO_MARKER) })),
    ...toUpdate.map((r) => ({ precio_venta: r.fields.precio_venta, esEst: !!r.fields.descripcion?.includes(PRECIO_ESTIMADO_MARKER) })),
  ]
  const conPvpReal  = allRecs.filter((r) => r.precio_venta != null && !r.esEst).length
  const conEstimado = allRecs.filter((r) => r.esEst).length
  const sinPrecio   = allRecs.filter((r) => r.precio_venta == null).length
  const sinCosto    = items.filter((i) => !(Number(i.costoUnitario) > 0)).length

  const sep  = '─'.repeat(58)
  const sep2 = '═'.repeat(58)

  console.log('\n' + sep2)
  console.log(`  SYNC TALLERGP → INVENTARIO${APPLY ? ' — RESULTADO APPLY' : ' — DRY-RUN'}`)
  console.log(sep2)
  console.log(`  Total leídos:                ${String(total).padStart(5)}`)
  console.log(`  Válidos:                     ${String(validTotal).padStart(5)}`)
  console.log(`  Inválidos:                   ${String(invalid.length).padStart(5)}`)
  console.log(sep)
  console.log(`  Se ${APPLY ? 'CREARON' : 'CREARÍAN'}:               ${String(toCreate.length).padStart(5)}`)
  console.log(`  Se ${APPLY ? 'ACTUALIZARON' : 'ACTUALIZARÍAN'}:          ${String(toUpdate.length).padStart(5)}`)
  console.log(sep)
  console.log(`  Con pvp real (TallerGP):     ${String(conPvpReal).padStart(5)}`)
  console.log(`  Precio estimado ×1.40:       ${String(conEstimado).padStart(5)}  (pvp = 0 en TallerGP)`)
  console.log(`  Sin precio (costo = 0):      ${String(sinPrecio).padStart(5)}`)
  console.log(`  Sin costo:                   ${String(sinCosto).padStart(5)}`)
  console.log(`  Stock negativo → 0:          ${String(stockNegCount).padStart(5)}`)
  console.log(sep2)

  if (invalid.length > 0) {
    console.log(`\n⚠  Inválidos (${invalid.length}) — primeros 5:`)
    for (const { item, reason } of invalid.slice(0, 5)) {
      console.log(`   - [${item.codigo ?? '?'}] ${reason}`)
    }
    if (invalid.length > 5) console.log(`   … y ${invalid.length - 5} más`)
  }

  if (warnings.length > 0) {
    console.log(`\n⚠  Warnings (${warnings.length} total) — primeros 10:`)
    for (const w of warnings.slice(0, 10)) console.log(`   · ${w}`)
    if (warnings.length > 10) console.log(`   … y ${warnings.length - 10} más`)
  }

  // Muestra — pvp real
  const sampleReal = toCreate.filter((r) => r.precio_venta != null && !r.descripcion?.includes(PRECIO_ESTIMADO_MARKER)).slice(0, 4)
  if (sampleReal.length > 0) {
    console.log('\n📋 Muestra — pvp REAL de TallerGP:')
    for (const r of sampleReal) {
      const pv = `$${Number(r.precio_venta).toLocaleString('es-CL')}`
      const pc = r.precio_costo != null ? `$${Number(r.precio_costo).toLocaleString('es-CL')}` : '—'
      console.log(`   ${r.codigo.slice(0, 14).padEnd(15)} ${r.nombre.slice(0, 30).padEnd(31)} costo: ${pc.padStart(9)}  venta: ${pv.padStart(9)}`)
    }
  }

  // Muestra — precio estimado
  const sampleEst = toCreate.filter((r) => r.descripcion?.includes(PRECIO_ESTIMADO_MARKER)).slice(0, 4)
  if (sampleEst.length > 0) {
    console.log('\n📋 Muestra — precio ESTIMADO (pvp=0 en TallerGP):')
    for (const r of sampleEst) {
      const pv = `$${Number(r.precio_venta).toLocaleString('es-CL')}`
      const pc = r.precio_costo != null ? `$${Number(r.precio_costo).toLocaleString('es-CL')}` : '—'
      console.log(`   ${r.codigo.slice(0, 14).padEnd(15)} ${r.nombre.slice(0, 30).padEnd(31)} costo: ${pc.padStart(9)}  venta: ${pv.padStart(9)} [EST]`)
    }
  }

  // Muestra — sin precio
  const sampleSinPrecio = toCreate.filter((r) => r.precio_venta == null).slice(0, 3)
  if (sampleSinPrecio.length > 0) {
    console.log('\n📋 Muestra — SIN precio (costo = 0):')
    for (const r of sampleSinPrecio) {
      console.log(`   ${r.codigo.slice(0, 14).padEnd(15)} ${r.nombre.slice(0, 40)}`)
    }
  }

  if (toUpdate.length > 0) {
    console.log('\n📋 Muestra — primeros 5 a ACTUALIZAR (stock_actual intocable):')
    for (const r of toUpdate.slice(0, 5)) {
      const pv  = r.fields.precio_venta != null ? `$${Number(r.fields.precio_venta).toLocaleString('es-CL')}` : '—'
      const pc  = r.fields.precio_costo != null ? `$${Number(r.fields.precio_costo).toLocaleString('es-CL')}` : '—'
      const tag = r.fields.descripcion?.includes(PRECIO_ESTIMADO_MARKER) ? '[EST]' : '[pvp]'
      console.log(`   ${r.codigo.slice(0, 14).padEnd(15)} costo: ${pc.padStart(9)}  venta: ${pv.padStart(9)}  ${tag}`)
    }
  }

  console.log('\n' + sep)
  console.log('  Normalizer corregido: pvp → precioVenta ✓')
  console.log(sep)

  if (!APPLY) {
    console.log('\n  Para ejecutar la importación real:\n')
    console.log('  node --env-file=apps/web/.env.local \\')
    console.log('    scripts/tallergp/sync-materials-to-inventory.mjs --apply\n')
  }
}

// ─── Ejecución en lotes ───────────────────────────────────────────────────────

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function executeInserts(toCreate) {
  if (toCreate.length === 0) return 0
  let done = 0

  for (let i = 0; i < toCreate.length; i += BATCH_SIZE) {
    const batch = toCreate.slice(i, i + BATCH_SIZE)
    process.stdout.write(`  Insertando: ${i + batch.length}/${toCreate.length}…\r`)
    await sbPost('/repuestos', batch)
    done += batch.length
    if (i + BATCH_SIZE < toCreate.length) await sleep(150)
  }
  console.log(`  Insertados:  ${done}${' '.repeat(20)}`)
  return done
}

async function executeUpdates(toUpdate) {
  if (toUpdate.length === 0) return 0
  let done = 0

  for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
    const batch = toUpdate.slice(i, i + BATCH_SIZE)
    process.stdout.write(`  Actualizando: ${i + batch.length}/${toUpdate.length}…\r`)

    // Upsert con merge-duplicates — solo actualiza los campos del body.
    // stock_actual NO está en el body → no se toca.
    const records = batch.map((r) => ({ ...r.fields, codigo: r.codigo }))
    await sbPost(
      '/repuestos?on_conflict=org_id,codigo',
      records,
      { Prefer: 'resolution=merge-duplicates,return=minimal' }
    )
    done += batch.length
    if (i + BATCH_SIZE < toUpdate.length) await sleep(150)
  }
  console.log(`  Actualizados: ${done}${' '.repeat(20)}`)
  return done
}

// ─── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🔄 Sync TallerGP → Inventario${APPLY ? ' [APPLY]' : ' [DRY-RUN]'}`)

  const items = loadNormalized()
  console.log(`  📂 Leídos ${items.length} materiales desde ${NORMALIZED_FILE.split('/').slice(-3).join('/')}`)

  const { orgId, userId } = await discoverContext()
  console.log(`  🏢 Org:    ${orgId}`)
  console.log(`  👤 User:   ${userId}`)

  console.log('  🔍 Consultando inventario actual…')
  const existingMap = await fetchExistingRepuestos(orgId)
  console.log(`  📦 ${existingMap.size} repuestos ya en inventario`)

  const { toCreate, toUpdate, invalid, warnings, stockNegCount } =
    planSync(items, existingMap, orgId, userId)

  printReport(items, toCreate, toUpdate, invalid, warnings, stockNegCount)

  if (!APPLY) return

  console.log('\n🚀 Ejecutando importación…')
  const inserted = await executeInserts(toCreate)
  const updated  = await executeUpdates(toUpdate)

  const sep2 = '═'.repeat(58)
  console.log('\n' + sep2)
  console.log('  ✅ IMPORTACIÓN COMPLETADA')
  console.log(`  Nuevos registros creados:   ${inserted}`)
  console.log(`  Registros actualizados:     ${updated}`)
  console.log(sep2 + '\n')
}

main().catch((e) => {
  console.error('\n❌ Error fatal:', e.message)
  process.exit(1)
})

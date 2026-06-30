/**
 * audit-materials.mjs — Auditoría del catálogo TallerGP /materials
 *
 * Uso:
 *   node --env-file=apps/web/.env.local scripts/tallergp/audit-materials.mjs
 *
 * Requiere en el env:
 *   TALLERGP_API_URL        — base URL (ej: https://api.tallergp.com)
 *   TALLERGP_BEARER_TOKEN   — token de acceso
 *   (o TALLERGP_ACCESS_TOKEN como alternativa)
 *
 * No modifica Supabase.
 * No importa datos.
 * Solo lectura + informe local.
 *
 * Output: tmp/tallergp/materials-audit/
 */

import { createWriteStream, mkdirSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// ── Config ────────────────────────────────────────────────────────────────────

const ROOT = resolve(fileURLToPath(import.meta.url), '..', '..', '..')
const OUT_DIR = join(ROOT, 'tmp', 'tallergp', 'materials-audit')
const PER_PAGE = 100
const DELAY_MS = 300
const MAX_PAGES = 1000

const BASE_URL = (process.env.TALLERGP_API_URL ?? 'https://api.tallergp.com').replace(/\/$/, '')
// Soporta múltiples nombres de variable según la fuente del token
const TOKEN =
  process.env.TALLERGP_BEARER_TOKEN ||
  process.env.TALLERGP_ACCESS_TOKEN ||
  process.env.TALLERGP_API_KEY ||
  ''
const API_KEY = '' // ya incluido en TOKEN

// ── Seguridad: nunca imprimir credenciales ────────────────────────────────────

function maskToken(s) {
  if (!s) return '(vacío)'
  return s.slice(0, 4) + '****' + s.slice(-3)
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

async function apiFetch(path, params = {}) {
  const url = new URL(BASE_URL + path)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, String(v)))

  const headers = { Accept: 'application/json' }
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`
  else if (API_KEY) headers['Authorization'] = `Bearer ${API_KEY}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 30_000)

  try {
    const res = await fetch(url.toString(), { headers, signal: controller.signal })
    if (!res.ok) {
      const body = await res.text().catch(() => '')
      throw new Error(`HTTP ${res.status} ${res.statusText} — ${url.pathname} — ${body.slice(0, 200)}`)
    }
    return await res.json()
  } finally {
    clearTimeout(timer)
  }
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms))
}

// ── Endpoint probe: ¿existe el endpoint? ─────────────────────────────────────

async function probeEndpoint(path) {
  try {
    const res = await apiFetch(path, { page: 1, per_page: 1 })
    return { ok: true, data: res }
  } catch (err) {
    return { ok: false, error: err.message }
  }
}

// ── Paginación completa ───────────────────────────────────────────────────────

async function fetchAllPages(path, perPage = PER_PAGE) {
  const all = []
  let page = 1
  let totalPages = 1
  let totalCount = 0

  do {
    const res = await apiFetch(path, { page, per_page: perPage })

    // TallerGP devuelve data en res.data[] y paginación en res.pagination
    const items = Array.isArray(res?.data) ? res.data : (Array.isArray(res) ? res : [])
    all.push(...items)

    const pagination = res?.pagination ?? {}
    totalPages = Math.min(Number(pagination.total_pages ?? 1), MAX_PAGES)
    totalCount = Number(pagination.total_count ?? items.length)

    process.stdout.write(`\r  Descargando página ${page}/${totalPages} — ${all.length}/${totalCount} items...`)
    page++
    if (page <= totalPages) await sleep(DELAY_MS)
  } while (page <= totalPages)

  console.log()
  return all
}

// ── Normalización ─────────────────────────────────────────────────────────────

function toNum(v) {
  if (v === null || v === undefined || v === '') return null
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'))
  return isNaN(n) ? null : n
}

function toBool(v) {
  if (v === null || v === undefined) return null
  if (typeof v === 'boolean') return v
  const s = String(v).toLowerCase()
  if (['1', 'true', 'yes', 'si', 'sí', 'activo', 'active'].includes(s)) return true
  if (['0', 'false', 'no', 'inactivo', 'inactive'].includes(s)) return false
  return null
}

function detectKind(raw) {
  // Heurísticas para clasificar el tipo de material
  const type = String(raw.type ?? raw.type_id ?? raw.kind ?? '').toLowerCase()
  const ref = String(raw.reference ?? raw.code ?? '').toLowerCase()
  const desc = String(raw.description ?? raw.name ?? '').toLowerCase()

  if (['service', 'labor', 'mano_obra', 'labour', '2', '3'].some(t => type.includes(t))) return 'service'
  if (['package', 'paquete', 'kit', '4'].some(t => type.includes(t))) return 'package'
  if (['material', 'part', 'repuesto', '1'].some(t => type.includes(t))) return 'material'

  // Fallback por referencia/descripción
  const laborKeywords = ['hora', 'diagnostico', 'revision', 'servicio', 'inspeccion', 'mano de obra',
    'trabajo', 'labor', 'serv.']
  if (laborKeywords.some(k => desc.includes(k))) return 'service'

  return 'unknown'
}

function normalize(raw) {
  const codigo = (raw.reference ?? raw.code ?? raw.sku ?? null)
  const nombre = (raw.description ?? raw.name ?? raw.nombre ?? '')

  return {
    // TallerGP usa material_id, no id
    externalId: String(raw.material_id ?? raw.id ?? ''),
    codigo: codigo !== null ? String(codigo).trim() || null : null,
    nombre: String(nombre).trim(),
    descripcion: raw.long_description ?? raw.extended_description ?? null,
    categoria: raw.category ?? raw.category_name ?? raw.family ?? null,
    marca: raw.brand ?? raw.brand_name ?? null,
    proveedor: raw.supplier ?? raw.supplier_name ?? null,
    unidadMedida: raw.unit ?? raw.unit_name ?? null,
    costoUnitario: toNum(raw.cost_price ?? raw.cost ?? raw.purchase_price),
    // TallerGP usa pvp (Precio de Venta al Público) — no sale_price
    precioVenta: toNum(raw.pvp ?? raw.sale_price ?? raw.price ?? raw.unit_price),
    stockActual: toNum(raw.stock ?? raw.current_stock ?? raw.quantity),
    activo: toBool(raw.active ?? raw.enabled ?? raw.is_active),
    rawKind: detectKind(raw),
    raw,
  }
}

// ── Estadísticas ──────────────────────────────────────────────────────────────

function computeStats(items) {
  const total = items.length

  // Conteos básicos
  const activos = items.filter(i => i.activo === true).length
  const inactivos = items.filter(i => i.activo === false).length
  const activoDesconocido = items.filter(i => i.activo === null).length

  const sinCodigo = items.filter(i => !i.codigo).length
  const sinNombre = items.filter(i => !i.nombre || i.nombre.trim() === '').length
  const sinCosto = items.filter(i => i.costoUnitario === null).length
  const sinPrecioVenta = items.filter(i => i.precioVenta === null).length
  const sinStock = items.filter(i => i.stockActual === null).length
  const costoZero = items.filter(i => i.costoUnitario === 0).length
  const precioZero = items.filter(i => i.precioVenta === 0).length

  // Clasificación
  const porKind = {
    material: items.filter(i => i.rawKind === 'material').length,
    service: items.filter(i => i.rawKind === 'service').length,
    package: items.filter(i => i.rawKind === 'package').length,
    unknown: items.filter(i => i.rawKind === 'unknown').length,
  }

  // Duplicados
  const codigoCounts = {}
  const nombreCounts = {}
  for (const i of items) {
    if (i.codigo) codigoCounts[i.codigo] = (codigoCounts[i.codigo] ?? 0) + 1
    const n = i.nombre.toUpperCase().trim()
    if (n) nombreCounts[n] = (nombreCounts[n] ?? 0) + 1
  }
  const codigosDuplicados = Object.entries(codigoCounts).filter(([, c]) => c > 1)
  const nombresDuplicados = Object.entries(nombreCounts).filter(([, c]) => c > 1)

  // Mismo código, distinto precio o costo
  const porCodigo = {}
  for (const i of items) {
    if (!i.codigo) continue
    if (!porCodigo[i.codigo]) porCodigo[i.codigo] = []
    porCodigo[i.codigo].push(i)
  }
  const codigoPrecioDistinto = Object.entries(porCodigo)
    .filter(([, arr]) => {
      const precios = new Set(arr.map(i => i.precioVenta))
      return precios.size > 1
    })
    .map(([codigo]) => codigo)

  const codigoCostoDistinto = Object.entries(porCodigo)
    .filter(([, arr]) => {
      const costos = new Set(arr.map(i => i.costoUnitario))
      return costos.size > 1
    })
    .map(([codigo]) => codigo)

  // Precios
  const conAmbos = items.filter(i => i.costoUnitario !== null && i.precioVenta !== null && i.costoUnitario > 0 && i.precioVenta > 0)
  const margenNegativo = conAmbos.filter(i => i.precioVenta < i.costoUnitario)
  const margenCero = conAmbos.filter(i => i.precioVenta === i.costoUnitario)
  const margenes = conAmbos.map(i => ((i.precioVenta - i.costoUnitario) / i.costoUnitario) * 100)
  const margenPromedio = margenes.length > 0
    ? margenes.reduce((a, b) => a + b, 0) / margenes.length
    : null

  // Margen por categoría
  const margenPorCat = {}
  for (const i of conAmbos) {
    const cat = i.categoria ?? 'Sin categoría'
    if (!margenPorCat[cat]) margenPorCat[cat] = []
    margenPorCat[cat].push(((i.precioVenta - i.costoUnitario) / i.costoUnitario) * 100)
  }
  const margenPromedioporCat = Object.fromEntries(
    Object.entries(margenPorCat).map(([cat, ms]) => [
      cat,
      Math.round(ms.reduce((a, b) => a + b, 0) / ms.length)
    ])
  )

  // Stock
  const stockNegativo = items.filter(i => i.stockActual !== null && i.stockActual < 0)
  const stockCero = items.filter(i => i.stockActual === 0)
  const stockPositivo = items.filter(i => i.stockActual !== null && i.stockActual > 0)

  // Score de calidad
  const completitudCodigo = total > 0 ? (1 - sinCodigo / total) : 0
  const completitudCosto = total > 0 ? (1 - sinCosto / total) : 0
  const completitudPrecio = total > 0 ? (1 - sinPrecioVenta / total) : 0
  const completitudStock = total > 0 ? (1 - sinStock / total) : 0
  const sinMargenNeg = total > 0 ? (1 - margenNegativo.length / total) : 1
  const score = (completitudCodigo + completitudCosto + completitudPrecio + completitudStock + sinMargenNeg) / 5

  let scoreLabel = score >= 0.8 ? 'bueno' : score >= 0.6 ? 'aceptable' : 'malo'

  return {
    total, activos, inactivos, activoDesconocido,
    sinCodigo, sinNombre, sinCosto, sinPrecioVenta, sinStock, costoZero, precioZero,
    porKind,
    codigosDuplicados, nombresDuplicados, codigoPrecioDistinto, codigoCostoDistinto,
    margenNegativo, margenCero,
    margenPromedio: margenPromedio !== null ? Math.round(margenPromedio) : null,
    margenPromedioporCat,
    stockNegativo, stockCero, stockPositivo,
    score: Math.round(score * 100),
    scoreLabel,
    completitudCodigo: Math.round(completitudCodigo * 100),
    completitudCosto: Math.round(completitudCosto * 100),
    completitudPrecio: Math.round(completitudPrecio * 100),
    completitudStock: Math.round(completitudStock * 100),
  }
}

// ── Generación de informe Markdown ────────────────────────────────────────────

function buildReport(items, stats, probeResults, ts) {
  const lines = []
  const fmt = n => n.toLocaleString('es-CL')

  lines.push(`# Informe de Auditoría — Catálogo TallerGP /materials`)
  lines.push(`\nGenerado: ${ts}`)
  lines.push(`\n---\n`)

  // Estado del endpoint
  lines.push(`## Estado de endpoints`)
  lines.push(`\n| Endpoint | Estado | Detalle |`)
  lines.push(`|---|---|---|`)
  for (const [ep, result] of Object.entries(probeResults)) {
    const estado = result.ok ? '✓ Disponible' : '✗ No disponible'
    const detalle = result.ok
      ? `total_count: ${result.data?.pagination?.total_count ?? '?'}`
      : result.error?.slice(0, 80)
    lines.push(`| \`${ep}\` | ${estado} | ${detalle} |`)
  }
  lines.push('')

  if (stats.total === 0) {
    lines.push(`\n> **Sin datos.** El endpoint /materials no retornó registros o no está disponible.`)
    return lines.join('\n')
  }

  // Totales
  lines.push(`## Totales generales\n`)
  lines.push(`| Métrica | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| Total materiales | **${fmt(stats.total)}** |`)
  lines.push(`| Activos | ${fmt(stats.activos)} (${pct(stats.activos, stats.total)}%) |`)
  lines.push(`| Inactivos | ${fmt(stats.inactivos)} (${pct(stats.inactivos, stats.total)}%) |`)
  lines.push(`| Estado desconocido | ${fmt(stats.activoDesconocido)} |`)
  lines.push(`| Sin código | **${fmt(stats.sinCodigo)}** (${pct(stats.sinCodigo, stats.total)}%) |`)
  lines.push(`| Sin nombre | ${fmt(stats.sinNombre)} |`)
  lines.push(`| Sin costo | ${fmt(stats.sinCosto)} (${pct(stats.sinCosto, stats.total)}%) |`)
  lines.push(`| Sin precio venta | ${fmt(stats.sinPrecioVenta)} (${pct(stats.sinPrecioVenta, stats.total)}%) |`)
  lines.push(`| Sin stock informado | ${fmt(stats.sinStock)} (${pct(stats.sinStock, stats.total)}%) |`)
  lines.push(`| Costo = 0 | ${fmt(stats.costoZero)} |`)
  lines.push(`| Precio venta = 0 | ${fmt(stats.precioZero)} |`)
  lines.push('')

  // Clasificación
  lines.push(`## Clasificación por tipo\n`)
  lines.push(`| Tipo | Cantidad | % |`)
  lines.push(`|---|---|---|`)
  for (const [k, v] of Object.entries(stats.porKind)) {
    lines.push(`| ${k} | ${fmt(v)} | ${pct(v, stats.total)}% |`)
  }
  lines.push('')

  // Duplicados
  lines.push(`## Duplicados\n`)
  lines.push(`| Tipo duplicado | Cantidad |`)
  lines.push(`|---|---|`)
  lines.push(`| Códigos duplicados | ${fmt(stats.codigosDuplicados.length)} |`)
  lines.push(`| Nombres duplicados | ${fmt(stats.nombresDuplicados.length)} |`)
  lines.push(`| Mismo código, distinto precio | ${fmt(stats.codigoPrecioDistinto.length)} |`)
  lines.push(`| Mismo código, distinto costo | ${fmt(stats.codigoCostoDistinto.length)} |`)

  if (stats.codigosDuplicados.length > 0) {
    lines.push(`\n**Top 10 códigos duplicados:**`)
    lines.push(`\`\`\``)
    stats.codigosDuplicados.slice(0, 10).forEach(([c, n]) => lines.push(`  ${c} → ${n} veces`))
    lines.push(`\`\`\``)
  }
  lines.push('')

  // Precios y márgenes
  lines.push(`## Precios y márgenes\n`)
  lines.push(`| Métrica | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| Con costo Y precio | ${fmt(items.filter(i => i.costoUnitario > 0 && i.precioVenta > 0).length)} |`)
  lines.push(`| Margen negativo (precio < costo) | **${fmt(stats.margenNegativo.length)}** |`)
  lines.push(`| Margen cero (precio = costo) | ${fmt(stats.margenCero.length)} |`)
  lines.push(`| Margen promedio | ${stats.margenPromedio !== null ? stats.margenPromedio + '%' : 'N/A'} |`)
  lines.push('')

  if (Object.keys(stats.margenPromedioporCat).length > 0) {
    lines.push(`**Margen promedio por categoría:**`)
    lines.push(`\n| Categoría | Margen promedio |`)
    lines.push(`|---|---|`)
    Object.entries(stats.margenPromedioporCat)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 15)
      .forEach(([cat, m]) => lines.push(`| ${cat} | ${m}% |`))
    lines.push('')
  }

  // Stock
  lines.push(`## Stock\n`)
  lines.push(`| Estado | Cantidad |`)
  lines.push(`|---|---|`)
  lines.push(`| Stock positivo | ${fmt(stats.stockPositivo.length)} |`)
  lines.push(`| Stock = 0 | ${fmt(stats.stockCero.length)} |`)
  lines.push(`| Stock negativo | **${fmt(stats.stockNegativo.length)}** |`)
  lines.push(`| Sin dato de stock | ${fmt(stats.sinStock)} |`)
  lines.push('')

  // Score de calidad
  const scoreEmoji = stats.scoreLabel === 'bueno' ? '🟢' : stats.scoreLabel === 'aceptable' ? '🟡' : '🔴'
  lines.push(`## Score de calidad de datos\n`)
  lines.push(`### ${scoreEmoji} ${stats.scoreLabel.toUpperCase()} — ${stats.score}/100\n`)
  lines.push(`| Dimensión | Completitud |`)
  lines.push(`|---|---|`)
  lines.push(`| Códigos completos | ${stats.completitudCodigo}% |`)
  lines.push(`| Costos completos | ${stats.completitudCosto}% |`)
  lines.push(`| Precios completos | ${stats.completitudPrecio}% |`)
  lines.push(`| Stock informado | ${stats.completitudStock}% |`)
  lines.push(`| Sin margen negativo | ${Math.round((1 - stats.margenNegativo.length / Math.max(stats.total, 1)) * 100)}% |`)
  lines.push('')

  // Justificación
  lines.push(`**Justificación del score:**`)
  const issues = []
  if (stats.completitudCodigo < 70) issues.push(`- ${pct(stats.sinCodigo, stats.total)}% de registros sin código — dificulta identificación unívoca`)
  if (stats.completitudCosto < 70) issues.push(`- ${pct(stats.sinCosto, stats.total)}% sin costo — márgenes no calculables`)
  if (stats.completitudPrecio < 70) issues.push(`- ${pct(stats.sinPrecioVenta, stats.total)}% sin precio de venta`)
  if (stats.margenNegativo.length > 0) issues.push(`- ${fmt(stats.margenNegativo.length)} productos con margen negativo — precio < costo`)
  if (stats.codigosDuplicados.length > 0) issues.push(`- ${fmt(stats.codigosDuplicados.length)} códigos duplicados — riesgo de conflicto en upsert`)
  if (issues.length === 0) issues.push(`- Datos en buenas condiciones generales`)
  lines.push(issues.join('\n'))
  lines.push('')

  // Muestra de estructura detectada
  lines.push(`## Estructura de campos detectada (primer registro)\n`)
  if (items.length > 0) {
    const sample = items[0]
    lines.push(`\`\`\`json`)
    lines.push(JSON.stringify(sample.raw, null, 2).slice(0, 1500))
    if (JSON.stringify(sample.raw).length > 1500) lines.push('... (truncado)')
    lines.push(`\`\`\``)
  }
  lines.push('')

  // Campos disponibles en la API
  if (items.length > 0) {
    const allKeys = new Set()
    items.slice(0, 50).forEach(i => Object.keys(i.raw).forEach(k => allKeys.add(k)))
    lines.push(`## Campos detectados en la API\n`)
    lines.push(`\`\`\``)
    lines.push([...allKeys].sort().join(', '))
    lines.push(`\`\`\``)
  }

  return lines.join('\n')
}

function pct(n, total) {
  if (total === 0) return '0'
  return Math.round((n / total) * 100).toString()
}

// ── Compatibilidad con ERP ────────────────────────────────────────────────────

function buildCompatibilitySection(items) {
  const sample = items[0]?.raw ?? {}
  const apiFields = items.length > 0
    ? [...new Set(items.slice(0, 100).flatMap(i => Object.keys(i.raw)))]
    : []

  const erpFields = [
    'codigo', 'nombre', 'descripcion', 'marca', 'modelo_aplicacion',
    'categoria', 'unidad', 'precio_costo', 'precio_venta',
    'stock_actual', 'stock_minimo', 'proveedor', 'activo',
    'codigo_barra', 'ubicacion'
  ]

  const lines = []
  lines.push(`\n## Compatibilidad con ERP All Motors (tabla repuestos, Migration 004)\n`)
  lines.push(`| Campo ERP | Campo TallerGP | Mapeado | Notas |`)
  lines.push(`|---|---|---|---|`)

  const mappings = [
    ['codigo', 'reference / code', 'reference' in sample || 'code' in sample, 'Puede ser null — generar fallback'],
    ['nombre', 'description / name', 'description' in sample || 'name' in sample, 'Todo mayúsculas — normalizar'],
    ['descripcion', 'long_description', 'long_description' in sample, 'Puede no existir'],
    ['marca', 'brand / brand_name', 'brand' in sample || 'brand_name' in sample, ''],
    ['modelo_aplicacion', '—', false, 'No existe en TallerGP'],
    ['categoria', 'category / family', 'category' in sample || 'family' in sample, ''],
    ['unidad', 'unit', 'unit' in sample, 'Default "unidad" si null'],
    ['precio_costo', 'cost_price', 'cost_price' in sample, 'Viene como string en detail — parsear'],
    ['precio_venta', 'sale_price / unit_price', 'sale_price' in sample || 'unit_price' in sample, 'Viene como string en detail'],
    ['stock_actual', 'stock / current_stock', 'stock' in sample || 'current_stock' in sample, 'Importar stock=0 en primer ciclo'],
    ['stock_minimo', 'min_stock / minimum_stock', 'min_stock' in sample || 'minimum_stock' in sample, ''],
    ['proveedor', 'supplier / supplier_name', 'supplier' in sample || 'supplier_name' in sample, ''],
    ['activo', 'active / enabled', 'active' in sample || 'enabled' in sample, ''],
    ['codigo_barra', 'barcode / ean', 'barcode' in sample || 'ean' in sample, ''],
  ]

  for (const [erp, tgp, mapped, notes] of mappings) {
    const icon = mapped ? '✓' : '✗'
    lines.push(`| \`${erp}\` | \`${tgp}\` | ${icon} | ${notes} |`)
  }

  lines.push('')
  lines.push(`**Campos TallerGP que NO conviene importar:**`)
  lines.push(`- IDs internos de TallerGP (no tienen valor post-migración)`)
  lines.push(`- Campos de paquetes/kits (concepto diferente en nuestro ERP)`)
  lines.push(`- Flags de presentación (is_visible, order_index)`)
  lines.push(`- Datos de integración TallerGP (related_delivery_note_id, etc.)`)

  return lines.join('\n')
}

// ── Estrategia de importación ─────────────────────────────────────────────────

function buildImportStrategy(stats) {
  const lines = []
  lines.push(`\n## Estrategia futura: syncTallerGpMaterialsToInventory()\n`)
  lines.push(`**(Diseño — no implementar todavía)**\n`)

  lines.push(`### Principios`)
  lines.push(`- **Idempotente**: ejecutar N veces = mismo resultado que 1 vez`)
  lines.push(`- **Incremental**: solo procesa cambios desde última ejecución (si TallerGP provee updated_at)`)
  lines.push(`- **Seguro**: nunca sobrescribe stock_actual directamente`)
  lines.push(`- **Auditable**: todo movimiento de stock queda en movimientos_stock`)
  lines.push('')

  lines.push(`### Algoritmo de upsert`)
  lines.push(`\`\`\``)
  lines.push(`FOR EACH material IN tallergp_materials:`)
  lines.push(`  1. Buscar en repuestos WHERE org_id = ORG AND`)
  lines.push(`     (tallergp_id = material.id   -- si campo existe`)
  lines.push(`     OR codigo = material.reference)`)
  lines.push(``)
  lines.push(`  2. IF found:`)
  lines.push(`     UPDATE nombre, precio_venta, precio_costo, categoria, marca, activo, proveedor`)
  lines.push(`     WHERE eliminado_en IS NULL  -- no reactivar soft-deleted`)
  lines.push(`     -- NUNCA tocar stock_actual: solo movimientos_stock pueden hacerlo`)
  lines.push(``)
  lines.push(`  3. IF NOT found:`)
  lines.push(`     INSERT repuesto con stock_actual = 0`)
  lines.push(`     IF material.stock > 0:`)
  lines.push(`       INSERT movimientos_stock tipo='ajuste'`)
  lines.push(`       -- El trigger fn_actualizar_stock_repuesto actualiza stock_actual`)
  lines.push(``)
  lines.push(`  4. IF material.active = false AND found:`)
  lines.push(`     Marcar para revisión manual (no soft_delete automático)`)
  lines.push(`\`\`\``)
  lines.push('')

  lines.push(`### Clave de sincronización recomendada`)
  lines.push(`1. **Primaria**: \`tallergp_id\` (campo a agregar en migration 005 como TEXT nullable)`)
  lines.push(`2. **Fallback**: \`codigo\` (UNIQUE constraint ya existe en (org_id, codigo))`)
  lines.push(`3. **No usar nombre**: demasiado propenso a variaciones tipográficas`)
  lines.push('')

  lines.push(`### Reglas de negocio`)
  lines.push(`- Nunca sobrescribir precio editado manualmente sin flag \`allow_price_override\``)
  lines.push(`- Stock inicial: 0 en todos (ajustar manualmente o desde /materials/{id}/movements)`)
  lines.push(`- Inactivos TallerGP: marcar \`activo=false\` en repuesto, NO soft-delete`)
  lines.push(`- Duplicados por código: loguear warning, no insertar, requieren revisión manual`)
  lines.push('')

  if (stats.scoreLabel === 'bueno') {
    lines.push(`### Recomendación: ✓ LISTO PARA IMPORTAR`)
    lines.push(`Los datos tienen buena calidad. Se puede proceder con la importación.`)
  } else if (stats.scoreLabel === 'aceptable') {
    lines.push(`### Recomendación: ⚠ LIMPIAR ANTES`)
    lines.push(`Calidad aceptable pero requiere limpieza previa:`)
    if (stats.sinCodigo > 0) lines.push(`- Asignar códigos a los ${stats.sinCodigo} registros sin código`)
    if (stats.margenNegativo.length > 0) lines.push(`- Revisar ${stats.margenNegativo.length} productos con margen negativo`)
    if (stats.codigosDuplicados.length > 0) lines.push(`- Resolver ${stats.codigosDuplicados.length} códigos duplicados`)
  } else {
    lines.push(`### Recomendación: ✗ NO IMPORTAR SIN LIMPIEZA`)
    lines.push(`Calidad insuficiente. Requiere limpieza en TallerGP antes de migrar.`)
  }

  return lines.join('\n')
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)
  console.log('\n══════════════════════════════════════════════════')
  console.log('  All Motors — Auditoría catálogo TallerGP')
  console.log(`  ${ts}`)
  console.log('══════════════════════════════════════════════════\n')

  // Verificar configuración
  if (!BASE_URL) {
    console.error('ERROR: TALLERGP_API_URL no configurado')
    process.exit(1)
  }
  if (!TOKEN) {
    console.error('ERROR: Credencial no configurada.')
    console.error('  Define una de estas variables de entorno:')
    console.error('    TALLERGP_ACCESS_TOKEN  (migration-toolkit/.env)')
    console.error('    TALLERGP_BEARER_TOKEN  (apps/web/.env.local)')
    console.error('    TALLERGP_API_KEY       (apps/web/.env.local)')
    console.error('')
    console.error('  Obtener el token: TallerGP → Configuración → API → Acceso general')
    process.exit(1)
  }

  console.log(`  Base URL: ${BASE_URL}`)
  console.log(`  Token:    ${maskToken(TOKEN || API_KEY)}`)
  console.log()

  // FASE 0: Probar endpoints disponibles
  console.log('FASE 0 — Probando endpoints disponibles...')
  const probeTargets = ['/materials', '/suppliers', '/brands', '/materials/movements']
  const probeResults = {}
  for (const ep of probeTargets) {
    process.stdout.write(`  ${ep} ... `)
    const result = await probeEndpoint(ep)
    probeResults[ep] = result
    console.log(result.ok ? `✓ (total: ${result.data?.pagination?.total_count ?? '?'})` : `✗ ${result.error?.slice(0, 60)}`)
  }
  console.log()

  if (!probeResults['/materials']?.ok) {
    console.error('FATAL: /materials no responde. No se puede continuar.')
    // Guardar reporte de error
    mkdirSync(OUT_DIR, { recursive: true })
    const errorReport = buildReport([], { total: 0 }, probeResults, ts)
    writeFileSync(join(OUT_DIR, 'materials-quality-report.md'), errorReport, 'utf-8')
    console.log(`  Reporte de error guardado en ${OUT_DIR}/materials-quality-report.md`)
    process.exit(1)
  }

  // FASE 1: Descargar todo el catálogo
  console.log('FASE 1 — Descargando catálogo completo...')
  let rawMaterials = []
  try {
    rawMaterials = await fetchAllPages('/materials', PER_PAGE)
  } catch (err) {
    console.error(`Error descargando /materials: ${err.message}`)
    process.exit(1)
  }
  console.log(`  Total descargados: ${rawMaterials.length}\n`)

  // FASE 2: Normalizar
  console.log('FASE 2 — Normalizando...')
  const normalized = rawMaterials.map(normalize)
  console.log(`  Normalizados: ${normalized.length}\n`)

  // FASE 3: Estadísticas
  console.log('FASE 3 — Calculando estadísticas...')
  const stats = computeStats(normalized)
  console.log(`  Score de calidad: ${stats.score}/100 — ${stats.scoreLabel.toUpperCase()}\n`)

  // FASE 4: Guardar archivos
  console.log('FASE 4 — Guardando archivos...')
  mkdirSync(OUT_DIR, { recursive: true })

  // materials-normalized.json (sin raw para no ser demasiado grande)
  const normalizedNoRaw = normalized.map(({ raw, ...rest }) => rest)
  writeFileSync(
    join(OUT_DIR, 'materials-normalized.json'),
    JSON.stringify({ generated: ts, total: normalized.length, items: normalizedNoRaw }, null, 2),
    'utf-8'
  )
  console.log(`  ✓ materials-normalized.json`)

  // materials-sample.json (primeros 20 con raw)
  writeFileSync(
    join(OUT_DIR, 'materials-sample.json'),
    JSON.stringify({ generated: ts, note: 'Primeros 20 registros con raw completo', items: normalized.slice(0, 20) }, null, 2),
    'utf-8'
  )
  console.log(`  ✓ materials-sample.json`)

  // materials-quality-report.md
  const report = [
    buildReport(normalized, stats, probeResults, ts),
    buildCompatibilitySection(normalized),
    buildImportStrategy(stats),
  ].join('\n\n---\n\n')
  writeFileSync(join(OUT_DIR, 'materials-quality-report.md'), report, 'utf-8')
  console.log(`  ✓ materials-quality-report.md`)

  // Imprimir resumen en consola
  console.log('\n══════════════════════════════════════════════════')
  console.log('  RESUMEN')
  console.log('══════════════════════════════════════════════════')
  console.log(`  Total materiales:    ${stats.total}`)
  console.log(`  Activos:             ${stats.activos}`)
  console.log(`  Inactivos:           ${stats.inactivos}`)
  console.log(`  Sin código:          ${stats.sinCodigo} (${Math.round(stats.sinCodigo/Math.max(stats.total,1)*100)}%)`)
  console.log(`  Sin costo:           ${stats.sinCosto} (${Math.round(stats.sinCosto/Math.max(stats.total,1)*100)}%)`)
  console.log(`  Sin precio venta:    ${stats.sinPrecioVenta} (${Math.round(stats.sinPrecioVenta/Math.max(stats.total,1)*100)}%)`)
  console.log(`  Margen negativo:     ${stats.margenNegativo.length}`)
  console.log(`  Margen promedio:     ${stats.margenPromedio !== null ? stats.margenPromedio + '%' : 'N/A'}`)
  console.log(`  Duplicados (código): ${stats.codigosDuplicados.length}`)
  console.log(`  Score calidad:       ${stats.score}/100 — ${stats.scoreLabel.toUpperCase()}`)
  console.log(`\n  Por tipo:`)
  Object.entries(stats.porKind).forEach(([k, v]) => console.log(`    ${k.padEnd(10)} ${v}`))
  console.log(`\n  Archivos en: ${OUT_DIR}`)
  console.log('══════════════════════════════════════════════════\n')
}

main().catch(err => {
  console.error('\nError fatal:', err.message)
  process.exit(1)
})

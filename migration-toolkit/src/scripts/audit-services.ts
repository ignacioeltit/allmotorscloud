/**
 * audit-services.ts — All Motors Migration Toolkit
 *
 * FASE 1: Descubre endpoints disponibles en la API TallerGP.
 * FASE 2/3: Descarga catálogo de manos de obra, servicios y paquetes.
 *           Si hay endpoints directos (/labor, /services, /packages), los usa.
 *           Si no, reconstruye desde historial de OTs.
 * FASE 4: Ingeniería inversa del cálculo de mano de obra.
 * FASE 5: Análisis de calidad y deduplicación.
 * FASE 6: Genera archivos de salida en tmp/tallergp/services-audit/
 *
 * Uso:
 *   cd migration-toolkit
 *   tsx src/scripts/audit-services.ts
 *   tsx src/scripts/audit-services.ts --max-ots 500   # Analizar más OTs
 *   tsx src/scripts/audit-services.ts --skip-discovery  # Solo OTs
 *
 * Solo GET. No modifica nada. No imprime tokens.
 */

import 'dotenv/config'
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { getClient } from '../api/tallergp/client.js'
import { getBearerToken } from '../api/tallergp/auth.js'
import { listRepairOrders, getRepairOrder } from '../api/tallergp/endpoints/repair-orders.js'
import type { AxiosInstance } from 'axios'

// ─── CLI args ─────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const getArg = (flag: string, fallback?: string): string | undefined => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : fallback
}
const hasFlag = (flag: string): boolean => args.includes(flag)

const MAX_OTS   = Number(getArg('--max-ots', '300'))
const OT_BATCH  = 50   // por página al listar OTs
const RATE_MS   = 350  // ms entre requests
const SKIP_DISC = hasFlag('--skip-discovery')

// ─── Paths ────────────────────────────────────────────────────────────────────

const OUT_DIR = resolve('../tmp/tallergp/services-audit')
mkdirSync(OUT_DIR, { recursive: true })

function savePath(name: string): string {
  return join(OUT_DIR, name)
}

function saveJson(name: string, data: unknown): void {
  const p = savePath(name)
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`  ✓ Guardado: ${p}`)
}

function saveMarkdown(name: string, content: string): void {
  const p = savePath(name)
  writeFileSync(p, content, 'utf-8')
  console.log(`  ✓ Guardado: ${p}`)
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function safeNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') {
    const n = parseFloat(v)
    return isNaN(n) ? 0 : n
  }
  return 0
}

function normStr(s: unknown): string {
  if (typeof s !== 'string') return ''
  return s.trim().toUpperCase()
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EndpointResult {
  endpoint: string
  status: number | 'ERROR' | 'TIMEOUT'
  available: boolean
  total?: number
  paginated?: boolean
  sampleFields?: string[]
  sampleRecord?: unknown
  error?: string
}

interface LaborLine {
  reference: string | null
  description: string
  quantity: number
  unitPriceNet: number
  discountPct: number
  totalNet: number
  costPrice: number
  employeeId: string | null
  employeeNumber: string | null
  packageId: string | null
  packageReference: string | null
  packageLineType: string | null
  workDate: string | null
  lineId: string
  otId: string
  otNumber: string
  otDate: string
}

interface ServiceNormalized {
  externalId: string
  codigo: string | null
  nombre: string
  descripcion: string | null
  categoria: string | null
  horasEstandar: number | null
  horasVariantes: number[]
  valorHora: number | null
  valorHoraVariantes: number[]
  precioNeto: number | null
  descuentoPromedio: number
  usoCount: number
  usadoEnOts: string[]
  esParte_dePaquete: boolean
  paqueteCodigos: string[]
  activo: boolean
  fuente: string
}

interface PackageNormalized {
  externalId: string
  codigo: string
  nombre: string
  descripcion: string | null
  categoria: string | null
  items: PackageItemNormalized[]
  totalHorasEstimado: number
  totalManoObraEstimado: number
  totalRepuestosEstimado: number
  usoCount: number
  usadoEnOts: string[]
  activo: boolean
  fuente: string
}

interface PackageItemNormalized {
  tipo: 'labor' | 'material' | 'service' | 'unknown'
  codigo: string | null
  nombre: string
  descripcion: string | null
  cantidad: number
  horas: number
  valorHora: number
  precioNeto: number
  materialCodigo: string | null
  packageLineType: string | null
}

interface CalcExample {
  otNumber: string
  description: string
  reference: string | null
  horas: number
  valorHora: number
  descuentoPct: number
  totalEsperado: number
  totalReal: number
  calculoVerificado: boolean
  nota: string
}

// ─── Probar endpoint ──────────────────────────────────────────────────────────

async function probeEndpoint(
  client: AxiosInstance,
  endpoint: string
): Promise<EndpointResult> {
  try {
    const res = await client.get(endpoint, {
      params: { page: 1, per_page: 3 },
      timeout: 10_000,
    })
    const data = res.data as Record<string, unknown>

    // Intentar detectar estructura paginada
    let total: number | undefined
    let paginated = false
    let sampleData: unknown[] = []

    if (data.pagination && typeof data.pagination === 'object') {
      const pg = data.pagination as Record<string, unknown>
      total = typeof pg.total_count === 'number' ? pg.total_count : undefined
      paginated = true
      sampleData = Array.isArray(data.data) ? (data.data as unknown[]) : []
    } else if (Array.isArray(data)) {
      sampleData = data.slice(0, 3)
    } else if (Array.isArray(data.data)) {
      sampleData = (data.data as unknown[]).slice(0, 3)
      total = typeof data.total === 'number' ? data.total : undefined
    }

    const sample = sampleData[0]
    const sampleFields = sample && typeof sample === 'object'
      ? Object.keys(sample as object).slice(0, 20)
      : []

    return {
      endpoint,
      status: res.status,
      available: true,
      total,
      paginated,
      sampleFields,
      sampleRecord: sampleData.length > 0 ? sampleData[0] : data,
    }
  } catch (err: unknown) {
    const e = err as { response?: { status?: number }; code?: string; message?: string }
    const status = e.response?.status ?? (e.code === 'ECONNABORTED' ? 'TIMEOUT' : 'ERROR')
    return {
      endpoint,
      status,
      available: false,
      error: e.message ?? 'unknown error',
    }
  }
}

// ─── FASE 1: Descubrimiento de endpoints ──────────────────────────────────────

async function fase1Discovery(client: AxiosInstance): Promise<EndpointResult[]> {
  console.log('\n══════════════════════════════════════════════════')
  console.log('  FASE 1 — Descubrimiento de endpoints')
  console.log('══════════════════════════════════════════════════')

  const endpoints = [
    // Mano de obra / servicios
    '/labor',
    '/labors',
    '/services',
    '/service-items',
    '/service-catalog',
    '/work-services',
    '/work-items',
    '/operations',
    '/tasks',
    '/maintenance',
    // Paquetes
    '/packages',
    '/service-packages',
    '/package',
    '/bundles',
    // Repuestos (ya conocido)
    '/materials',
    // OTs (ya conocido)
    '/repair-orders',
    '/work-orders',
    '/budgets',
    '/quotes',
    '/estimates',
    // Catálogos
    '/suppliers',
    '/brands',
    '/categories',
    '/employees',
    '/mechanics',
    '/technicians',
    // Otros
    '/invoices',
    '/clients',
    '/customers',
    '/vehicles',
  ]

  const results: EndpointResult[] = []

  for (const ep of endpoints) {
    process.stdout.write(`  Probando ${ep.padEnd(30)} `)
    const result = await probeEndpoint(client, ep)
    if (result.available) {
      process.stdout.write(`✓ HTTP ${result.status}`)
      if (result.total !== undefined) process.stdout.write(` total=${result.total}`)
      if (result.paginated) process.stdout.write(' [paginado]')
      process.stdout.write('\n')
    } else {
      process.stdout.write(`✗ HTTP ${result.status}\n`)
    }
    results.push(result)
    await sleep(RATE_MS)
  }

  return results
}

// ─── FASE 2: Descargar catálogo directo ───────────────────────────────────────

async function fase2DirectCatalog(
  client: AxiosInstance,
  discoveryResults: EndpointResult[]
): Promise<{
  laborDirect: unknown[]
  servicesDirect: unknown[]
  packagesDirect: unknown[]
}> {
  console.log('\n══════════════════════════════════════════════════')
  console.log('  FASE 2 — Catálogos directos (si existen)')
  console.log('══════════════════════════════════════════════════')

  const available = new Set(
    discoveryResults.filter((r) => r.available).map((r) => r.endpoint)
  )

  async function downloadAll(endpoint: string, perPage = 100): Promise<unknown[]> {
    const all: unknown[] = []
    let page = 1
    let totalPages = 1
    do {
      const res = await client.get(endpoint, { params: { page, per_page: perPage } })
      const data = res.data as Record<string, unknown>
      const items = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : []
      all.push(...(items as unknown[]))
      if (data.pagination && typeof data.pagination === 'object') {
        const pg = data.pagination as Record<string, unknown>
        totalPages = typeof pg.total_pages === 'number' ? pg.total_pages : 1
      }
      page++
      if (page <= totalPages) await sleep(RATE_MS)
    } while (page <= totalPages)
    return all
  }

  // Intentar labor
  const laborEndpoints = ['/labor', '/labors', '/work-services', '/service-items', '/operations']
  let laborDirect: unknown[] = []
  for (const ep of laborEndpoints) {
    if (available.has(ep)) {
      console.log(`  Descargando ${ep}...`)
      laborDirect = await downloadAll(ep)
      console.log(`  → ${laborDirect.length} registros`)
      saveJson('labor-raw.json', laborDirect)
      break
    }
  }
  if (laborDirect.length === 0) console.log('  → No hay endpoint directo de labor/servicios')

  // Intentar services
  const servEndpoints = ['/services', '/service-catalog', '/tasks', '/maintenance']
  let servicesDirect: unknown[] = []
  for (const ep of servEndpoints) {
    if (available.has(ep)) {
      console.log(`  Descargando ${ep}...`)
      servicesDirect = await downloadAll(ep)
      console.log(`  → ${servicesDirect.length} registros`)
      saveJson('services-raw.json', servicesDirect)
      break
    }
  }
  if (servicesDirect.length === 0) console.log('  → No hay endpoint directo de services')

  // Intentar packages
  const pkgEndpoints = ['/packages', '/service-packages', '/package', '/bundles']
  let packagesDirect: unknown[] = []
  for (const ep of pkgEndpoints) {
    if (available.has(ep)) {
      console.log(`  Descargando ${ep}...`)
      packagesDirect = await downloadAll(ep)
      console.log(`  → ${packagesDirect.length} registros`)
      saveJson('packages-raw.json', packagesDirect)
      break
    }
  }
  if (packagesDirect.length === 0) console.log('  → No hay endpoint directo de packages')

  return { laborDirect, servicesDirect, packagesDirect }
}

// ─── FASE 3: Reconstruir desde OTs históricas ─────────────────────────────────

interface OtSummary {
  entryId: string
  orderNumber: string
  date: string
  isClosed: boolean
}

// Checkpoint intermedio para no perder datos si hay rate-limit interruption
interface Checkpoint {
  processedIds: string[]
  laborLines: LaborLine[]
  partsLines: unknown[]
  packageHeaders: unknown[]
  savedAt: string
}

const CHECKPOINT_PATH = savePath('_checkpoint.json')
const CHECKPOINT_EVERY = 10 // guardar cada N OTs

function loadCheckpoint(): Checkpoint | null {
  try {
    if (!existsSync(CHECKPOINT_PATH)) return null
    const raw = readFileSync(CHECKPOINT_PATH, 'utf-8')
    const cp = JSON.parse(raw) as Checkpoint
    console.log(`  ✓ Checkpoint encontrado: ${cp.processedIds.length} OTs ya procesadas`)
    return cp
  } catch {
    return null
  }
}

function saveCheckpoint(cp: Checkpoint): void {
  cp.savedAt = new Date().toISOString()
  writeFileSync(CHECKPOINT_PATH, JSON.stringify(cp), 'utf-8')
}

function extractLinesFromDetail(
  detail: Record<string, unknown>,
  ot: OtSummary,
  allLaborLines: LaborLine[],
  allPartsLines: unknown[],
  allPackageHeaders: unknown[]
): void {
  // Package headers
  if (Array.isArray(detail.lines_package_parents)) {
    for (const ph of detail.lines_package_parents as unknown[]) {
      allPackageHeaders.push({ ...(ph as object), _otId: ot.entryId, _otNumber: ot.orderNumber })
    }
  }

  // Labor
  if (Array.isArray(detail.labor)) {
    for (const line of detail.labor as Record<string, unknown>[]) {
      allLaborLines.push({
        reference: typeof line.reference === 'string' ? line.reference : null,
        description: String(line.description ?? '').trim(),
        quantity: safeNum(line.quantity),
        unitPriceNet: safeNum(line.unit_price_net),
        discountPct: safeNum(line.discount_percentage),
        totalNet: safeNum(line.total_line_amount_net_calculated),
        costPrice: safeNum(line.cost_price),
        employeeId: typeof line.employee_id === 'string' ? line.employee_id : null,
        employeeNumber: typeof line.employee_number === 'string' ? line.employee_number : null,
        packageId: typeof line.package_id === 'string' ? line.package_id : null,
        packageReference: typeof line.package_reference === 'string' ? line.package_reference : null,
        packageLineType: typeof line.package_line_type === 'string' ? line.package_line_type : null,
        workDate: typeof line.work_date === 'string' ? line.work_date : null,
        lineId: String(line.line_id ?? ''),
        otId: ot.entryId,
        otNumber: ot.orderNumber,
        otDate: ot.date,
      })
    }
  }

  // Parts en paquetes
  if (Array.isArray(detail.parts)) {
    for (const line of detail.parts as Record<string, unknown>[]) {
      if (line.package_id) {
        allPartsLines.push({ ...line, _otId: ot.entryId, _otNumber: ot.orderNumber })
      }
    }
  }
}

async function fase3ReconstructFromOTs(maxOTs: number): Promise<{
  laborLines: LaborLine[]
  otsSampled: OtSummary[]
  partsLines: unknown[]
  packageHeaders: unknown[]
}> {
  console.log('\n══════════════════════════════════════════════════')
  console.log(`  FASE 3 — Reconstrucción desde OTs históricas (max=${maxOTs})`)
  console.log('══════════════════════════════════════════════════')

  // ── Cargar OTs cacheadas de sesiones anteriores ─────────────────────────────
  const allLaborLines: LaborLine[] = []
  const allPartsLines: unknown[] = []
  const allPackageHeaders: unknown[] = []

  // Cargar OTs raw ya descargadas en exports/raw/
  const rawDir = resolve('./exports/raw')
  const cachedOtFiles: string[] = existsSync(rawDir)
    ? readdirSync(rawDir).filter((f) => f.includes('_detail') && f.includes('repair_order'))
    : []

  const processedIds = new Set<string>()

  // Cargar checkpoint previo
  const checkpoint = loadCheckpoint()
  if (checkpoint) {
    for (const id of checkpoint.processedIds) processedIds.add(id)
    allLaborLines.push(...checkpoint.laborLines)
    allPartsLines.push(...checkpoint.partsLines)
    allPackageHeaders.push(...checkpoint.packageHeaders)
    console.log(`  Reanudando desde checkpoint: ${processedIds.size} OTs ya procesadas, ${allLaborLines.length} líneas de labor`)
  }

  // Procesar OTs cacheadas en disco
  for (const fname of cachedOtFiles as string[]) {
    try {
      const raw = JSON.parse(readFileSync(join(rawDir, fname), 'utf-8')) as Record<string, unknown>
      const entryId = String(raw.entry_id ?? '')
      const orderNumber = String(raw.order_number ?? '')
      if (!entryId || processedIds.has(entryId)) continue

      const ot: OtSummary = {
        entryId,
        orderNumber,
        date: String(raw.entry_date ?? ''),
        isClosed: !!raw.is_closed,
      }
      extractLinesFromDetail(raw, ot, allLaborLines, allPartsLines, allPackageHeaders)
      processedIds.add(entryId)
      console.log(`  ✓ Cargada OT cacheada: ${orderNumber} (${allLaborLines.length} labor lines total)`)
    } catch { /* ignorar archivos corruptos */ }
  }

  // ── Obtener lista de OTs para descargar ─────────────────────────────────────
  console.log('\n  Obteniendo lista de OTs...')
  const firstPage = await listRepairOrders({ page: 1, per_page: 1 })
  const totalOTs = firstPage.pagination.total_count
  console.log(`  Total OTs en sistema: ${totalOTs}`)

  const allOtsList: OtSummary[] = []
  let page = 1
  const perPage = Math.min(OT_BATCH, 100)
  // Descargar desde página 1 (más recientes) hasta cubrir maxOTs
  const maxPages = Math.ceil(Math.min(maxOTs, totalOTs) / perPage)

  while (allOtsList.length < maxOTs) {
    const res = await listRepairOrders({ page, per_page: perPage })
    for (const ot of res.data) {
      allOtsList.push({
        entryId: ot.entry_id,
        orderNumber: ot.order_number,
        date: ot.entry_date ?? '',
        isClosed: !!ot.is_closed,
      })
    }
    console.log(`  Página ${page}/${maxPages}: ${allOtsList.length} OTs en lista`)
    if (page >= maxPages || allOtsList.length >= totalOTs) break
    page++
    await sleep(RATE_MS)
  }

  // ── Descargar detalles de OTs no procesadas ──────────────────────────────────
  const pendingOTs = allOtsList.filter((ot) => !processedIds.has(ot.entryId))
  console.log(`\n  OTs pendientes de descargar: ${pendingOTs.length}`)
  console.log(`  (Ya procesadas: ${processedIds.size})`)

  let downloaded = 0
  let rateLimitHits = 0
  let errors = 0

  for (const ot of pendingOTs) {
    try {
      const detail = await getRepairOrder(ot.entryId) as Record<string, unknown>
      extractLinesFromDetail(detail, ot, allLaborLines, allPartsLines, allPackageHeaders)
      processedIds.add(ot.entryId)
      downloaded++

      // Guardar checkpoint incremental
      if (downloaded % CHECKPOINT_EVERY === 0) {
        saveCheckpoint({
          processedIds: [...processedIds],
          laborLines: allLaborLines,
          partsLines: allPartsLines,
          packageHeaders: allPackageHeaders,
          savedAt: '',
        })
        console.log(`  [checkpoint] ${downloaded} descargadas, ${allLaborLines.length} líneas labor`)
      }

      if (downloaded % 25 === 0) {
        console.log(`  ${downloaded}/${pendingOTs.length} descargadas (labor: ${allLaborLines.length}, rate-limits: ${rateLimitHits})`)
      }

      await sleep(RATE_MS)
    } catch (err: unknown) {
      const e = err as { message?: string }
      // El cliente ya maneja 429 con retry automático (Retry-After del header)
      // Si llega aquí fue un error genuino, no rate limit
      errors++
      if (e.message?.includes('429') || e.message?.toLowerCase().includes('rate')) {
        rateLimitHits++
        console.log(`  ⚠ Rate limit (${rateLimitHits}° vez) — el cliente reintentará automáticamente`)
      } else if (errors <= 5) {
        console.log(`  ⚠ Error en OT ${ot.orderNumber}: ${e.message}`)
      }
    }
  }

  // Guardar checkpoint final
  saveCheckpoint({
    processedIds: [...processedIds],
    laborLines: allLaborLines,
    partsLines: allPartsLines,
    packageHeaders: allPackageHeaders,
    savedAt: '',
  })

  const otsSampled: OtSummary[] = allOtsList.filter((ot) => processedIds.has(ot.entryId))

  console.log(`\n  Resumen extracción FASE 3:`)
  console.log(`  → Total OTs procesadas: ${processedIds.size} (${downloaded} nuevas, errores: ${errors})`)
  console.log(`  → Líneas de labor extraídas: ${allLaborLines.length}`)
  console.log(`  → Parts en paquetes: ${allPartsLines.length}`)
  console.log(`  → Package headers: ${allPackageHeaders.length}`)

  return {
    laborLines: allLaborLines,
    otsSampled,
    partsLines: allPartsLines,
    packageHeaders: allPackageHeaders,
  }
}

// ─── FASE 4: Ingeniería inversa del cálculo ───────────────────────────────────

function fase4CalcExamples(laborLines: LaborLine[]): {
  examples: CalcExample[]
  valorHoraAnalysis: Record<number, { count: number; employees: Set<string>; services: string[] }>
} {
  console.log('\n══════════════════════════════════════════════════')
  console.log('  FASE 4 — Ingeniería inversa del cálculo')
  console.log('══════════════════════════════════════════════════')

  const examples: CalcExample[] = []
  const valorHoraMap: Record<number, { count: number; employees: Set<string>; services: string[] }> = {}

  // Solo líneas con datos útiles (no sub-items de paquetes con qty=0)
  const meaningfulLines = laborLines.filter(
    (l) => l.quantity > 0 && l.unitPriceNet > 0
  )

  for (const line of meaningfulLines.slice(0, 200)) {
    const calculado = Math.round(line.quantity * line.unitPriceNet * (1 - line.discountPct / 100))
    const real = Math.round(line.totalNet)
    const diff = Math.abs(calculado - real)
    const verified = diff <= 1 // tolerancia 1 CLP por redondeo

    examples.push({
      otNumber: line.otNumber,
      description: line.description,
      reference: line.reference,
      horas: line.quantity,
      valorHora: line.unitPriceNet,
      descuentoPct: line.discountPct,
      totalEsperado: calculado,
      totalReal: real,
      calculoVerificado: verified,
      nota: !verified ? `Diferencia de $${diff}` : '',
    })

    // Registrar valor hora
    const vh = line.unitPriceNet
    if (!valorHoraMap[vh]) {
      valorHoraMap[vh] = { count: 0, employees: new Set(), services: [] }
    }
    valorHoraMap[vh].count++
    if (line.employeeNumber) valorHoraMap[vh].employees.add(line.employeeNumber)
    if (line.reference && !valorHoraMap[vh].services.includes(line.reference)) {
      valorHoraMap[vh].services.push(line.reference)
    }
  }

  const verified = examples.filter((e) => e.calculoVerificado).length
  console.log(`  Ejemplos calculados: ${examples.length}`)
  console.log(`  Fórmula verificada: ${verified}/${examples.length} (${Math.round(verified / examples.length * 100)}%)`)

  // Valores hora encontrados
  const sortedVH = Object.entries(valorHoraMap)
    .sort(([, a], [, b]) => b.count - a.count)

  console.log(`\n  Valores hora encontrados:`)
  for (const [vh, info] of sortedVH.slice(0, 10)) {
    console.log(`  → $${Number(vh).toLocaleString('es-CL')}/hr × ${info.count} veces — empleados: [${[...info.employees].join(',')}]`)
  }

  return { examples, valorHoraAnalysis: valorHoraMap }
}

// ─── FASE 5: Normalizar y deduplicar ─────────────────────────────────────────

function normalizeKey(ref: string | null, desc: string): string {
  if (ref && ref.trim()) return ref.trim().toUpperCase()
  return normStr(desc).replace(/\s+/g, '_').slice(0, 50)
}

function fase5Normalize(
  laborLines: LaborLine[],
  packageHeaders: unknown[],
  partsLines: unknown[]
): { services: ServiceNormalized[]; packages: PackageNormalized[] } {
  console.log('\n══════════════════════════════════════════════════')
  console.log('  FASE 5 — Normalización y deduplicación')
  console.log('══════════════════════════════════════════════════')

  // ── Agrupar servicios por clave (ref o descripción normalizada) ───────────
  const serviceMap = new Map<string, ServiceNormalized>()

  for (const line of laborLines) {
    // Ignorar sub-items de paquetes con qty=0 y price=0 (son checklist, no servicios reales)
    const isPackageSubItem = line.packageId !== null && line.quantity === 0 && line.unitPriceNet === 0
    const key = normalizeKey(line.reference, line.description)

    if (!serviceMap.has(key)) {
      serviceMap.set(key, {
        externalId: key,
        codigo: line.reference ? line.reference.trim() : null,
        nombre: line.description,
        descripcion: null,
        categoria: null,
        horasEstandar: null,
        horasVariantes: [],
        valorHora: null,
        valorHoraVariantes: [],
        precioNeto: null,
        descuentoPromedio: 0,
        usoCount: 0,
        usadoEnOts: [],
        esParte_dePaquete: false,
        paqueteCodigos: [],
        activo: true,
        fuente: 'ot_history',
      })
    }

    const svc = serviceMap.get(key)!
    svc.usoCount++

    if (!svc.usadoEnOts.includes(line.otNumber)) {
      svc.usadoEnOts.push(line.otNumber)
    }

    if (line.packageId) {
      svc.esParte_dePaquete = true
      const pkgRef = line.packageReference ?? line.packageId
      if (!svc.paqueteCodigos.includes(pkgRef)) {
        svc.paqueteCodigos.push(pkgRef)
      }
    }

    if (!isPackageSubItem) {
      if (line.quantity > 0 && !svc.horasVariantes.includes(line.quantity)) {
        svc.horasVariantes.push(line.quantity)
      }
      if (line.unitPriceNet > 0 && !svc.valorHoraVariantes.includes(line.unitPriceNet)) {
        svc.valorHoraVariantes.push(line.unitPriceNet)
      }
    }
  }

  // Calcular valores estándar (moda de horas, valor hora más frecuente)
  for (const [, svc] of serviceMap) {
    if (svc.horasVariantes.length > 0) {
      // Moda de horas
      const freq = new Map<number, number>()
      for (const h of svc.horasVariantes) freq.set(h, (freq.get(h) ?? 0) + 1)
      svc.horasEstandar = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }
    if (svc.valorHoraVariantes.length > 0) {
      const freq = new Map<number, number>()
      for (const v of svc.valorHoraVariantes) freq.set(v, (freq.get(v) ?? 0) + 1)
      svc.valorHora = [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
      if (svc.horasEstandar !== null && svc.valorHora !== null) {
        svc.precioNeto = Math.round(svc.horasEstandar * svc.valorHora)
      }
    }
  }

  const services = [...serviceMap.values()].sort((a, b) => b.usoCount - a.usoCount)

  // ── Reconstruir paquetes ───────────────────────────────────────────────────
  const packageMap = new Map<string, PackageNormalized>()

  // Registrar paquetes desde headers
  for (const ph of packageHeaders as Record<string, unknown>[]) {
    const ref = String(ph.reference ?? ph.package_id ?? '').trim()
    const desc = String(ph.description ?? '').trim()
    if (!ref) continue

    if (!packageMap.has(ref)) {
      packageMap.set(ref, {
        externalId: String(ph.package_id ?? ref),
        codigo: ref,
        nombre: desc,
        descripcion: null,
        categoria: null,
        items: [],
        totalHorasEstimado: 0,
        totalManoObraEstimado: 0,
        totalRepuestosEstimado: 0,
        usoCount: 0,
        usadoEnOts: [],
        activo: true,
        fuente: 'ot_history',
      })
    }

    const pkg = packageMap.get(ref)!
    const otNum = String(ph._otNumber ?? '')
    if (otNum && !pkg.usadoEnOts.includes(otNum)) {
      pkg.usadoEnOts.push(otNum)
      pkg.usoCount++
    }
  }

  // Agregar items de labor a cada paquete
  for (const line of laborLines) {
    if (!line.packageReference) continue
    const ref = line.packageReference.trim()
    if (!packageMap.has(ref)) {
      // Crear paquete si solo lo vimos en labor (sin header)
      packageMap.set(ref, {
        externalId: line.packageId ?? ref,
        codigo: ref,
        nombre: ref,
        descripcion: null,
        categoria: null,
        items: [],
        totalHorasEstimado: 0,
        totalManoObraEstimado: 0,
        totalRepuestosEstimado: 0,
        usoCount: 1,
        usadoEnOts: [line.otNumber],
        activo: true,
        fuente: 'ot_history_labor',
      })
    }

    const pkg = packageMap.get(ref)!

    // Solo agregar item si no es duplicado exacto
    const alreadyHas = pkg.items.some(
      (i) => i.codigo === line.reference && i.nombre === line.description
    )
    if (!alreadyHas) {
      pkg.items.push({
        tipo: 'labor',
        codigo: line.reference,
        nombre: line.description,
        descripcion: null,
        cantidad: line.quantity,
        horas: line.quantity,
        valorHora: line.unitPriceNet,
        precioNeto: line.totalNet,
        materialCodigo: null,
        packageLineType: line.packageLineType,
      })
    }
    pkg.totalHorasEstimado += line.quantity
  }

  // Agregar parts de paquetes
  for (const part of partsLines as Record<string, unknown>[]) {
    const ref = String(part.package_reference ?? part.package_id ?? '').trim()
    if (!ref || !packageMap.has(ref)) continue
    const pkg = packageMap.get(ref)!

    const alreadyHas = pkg.items.some(
      (i) => i.codigo === part.reference && i.tipo === 'material'
    )
    if (!alreadyHas) {
      pkg.items.push({
        tipo: 'material',
        codigo: typeof part.reference === 'string' ? part.reference : null,
        nombre: String(part.description ?? ''),
        descripcion: null,
        cantidad: safeNum(part.quantity),
        horas: 0,
        valorHora: 0,
        precioNeto: safeNum(part.total_line_amount_net_calculated),
        materialCodigo: typeof part.reference === 'string' ? part.reference : null,
        packageLineType: typeof part.package_line_type === 'string' ? part.package_line_type : null,
      })
    }
    pkg.totalRepuestosEstimado += safeNum(part.total_line_amount_net_calculated)
  }

  // Calcular total mano de obra por paquete
  for (const [, pkg] of packageMap) {
    const moPrecio = pkg.items
      .filter((i) => i.tipo === 'labor' && i.packageLineType === '2')
      .reduce((sum, i) => sum + i.precioNeto, 0)
    // Si no hay línea tipo 2, sumar todas las de labor
    if (moPrecio === 0) {
      pkg.totalManoObraEstimado = pkg.items
        .filter((i) => i.tipo === 'labor')
        .reduce((sum, i) => sum + i.precioNeto, 0)
    } else {
      pkg.totalManoObraEstimado = moPrecio
    }
  }

  const packages = [...packageMap.values()].sort((a, b) => b.usoCount - a.usoCount)

  console.log(`  Servicios únicos: ${services.length}`)
  console.log(`  Paquetes únicos: ${packages.length}`)

  // Stats de servicios
  const conCodigo = services.filter((s) => s.codigo !== null).length
  const conHoras = services.filter((s) => s.horasEstandar !== null).length
  const enPaquete = services.filter((s) => s.esParte_dePaquete).length
  console.log(`  → Con código: ${conCodigo}/${services.length}`)
  console.log(`  → Con horas: ${conHoras}/${services.length}`)
  console.log(`  → En paquetes: ${enPaquete}/${services.length}`)

  return { services, packages }
}

// ─── FASE 6: Análisis de calidad y deduplicación ─────────────────────────────

interface ServiceQualityReport {
  totalServicios: number
  conCodigo: number
  sinCodigo: number
  conHoras: number
  sinHoras: number
  conPrecio: number
  sinPrecio: number
  conDescuento: number
  usadosMasDeUnaVez: number
  usadosSoloUnaVez: number
  enPaquetes: number
  solosNoEnPaquete: number
  codigosDuplicados: { codigo: string; variantes: number; nombres: string[] }[]
  descripcionesDuplicadas: { nombre: string; codigos: string[]; count: number }[]
  mismoCodDistintasHoras: { codigo: string; horas: number[]; count: number }[]
  mismoCodDistintoPrecio: { codigo: string; precios: number[]; count: number }[]
  serviciosGratuitos: ServiceNormalized[]
  totalPaquetes: number
  paquetesConItems: number
  paquetesFrecuentes: PackageNormalized[]
  paquetesDeInspeccion: PackageNormalized[]
  paquetesConRepuestos: PackageNormalized[]
}

function fase5QualityAnalysis(
  services: ServiceNormalized[],
  packages: PackageNormalized[]
): ServiceQualityReport {
  const report: ServiceQualityReport = {
    totalServicios: services.length,
    conCodigo: services.filter((s) => s.codigo !== null).length,
    sinCodigo: services.filter((s) => s.codigo === null).length,
    conHoras: services.filter((s) => s.horasEstandar !== null).length,
    sinHoras: services.filter((s) => s.horasEstandar === null).length,
    conPrecio: services.filter((s) => s.precioNeto !== null && s.precioNeto > 0).length,
    sinPrecio: services.filter((s) => s.precioNeto === null || s.precioNeto === 0).length,
    conDescuento: services.filter((s) => s.descuentoPromedio > 0).length,
    usadosMasDeUnaVez: services.filter((s) => s.usoCount > 1).length,
    usadosSoloUnaVez: services.filter((s) => s.usoCount === 1).length,
    enPaquetes: services.filter((s) => s.esParte_dePaquete).length,
    solosNoEnPaquete: services.filter((s) => !s.esParte_dePaquete).length,
    codigosDuplicados: [],
    descripcionesDuplicadas: [],
    mismoCodDistintasHoras: [],
    mismoCodDistintoPrecio: [],
    serviciosGratuitos: services.filter(
      (s) => s.precioNeto !== null && s.precioNeto === 0 && s.horasEstandar !== null
    ),
    totalPaquetes: packages.length,
    paquetesConItems: packages.filter((p) => p.items.length > 0).length,
    paquetesFrecuentes: packages.filter((p) => p.usoCount >= 3),
    paquetesDeInspeccion: packages.filter(
      (p) => p.nombre.toUpperCase().includes('INSPEC') ||
             p.nombre.toUpperCase().includes('REVIS') ||
             p.nombre.toUpperCase().includes('PUNTOS')
    ),
    paquetesConRepuestos: packages.filter((p) => p.items.some((i) => i.tipo === 'material')),
  }

  // Detectar códigos duplicados (mismo código, distintas descripciones)
  const byCodigo = new Map<string, ServiceNormalized[]>()
  for (const s of services) {
    if (!s.codigo) continue
    if (!byCodigo.has(s.codigo)) byCodigo.set(s.codigo, [])
    byCodigo.get(s.codigo)!.push(s)
  }
  for (const [cod, items] of byCodigo) {
    if (items.length > 1) {
      report.codigosDuplicados.push({
        codigo: cod,
        variantes: items.length,
        nombres: items.map((i) => i.nombre),
      })
    }
    // Mismo código, distintas horas
    const allHoras = [...new Set(items.flatMap((i) => i.horasVariantes))]
    if (allHoras.length > 1) {
      report.mismoCodDistintasHoras.push({
        codigo: cod,
        horas: allHoras,
        count: items.reduce((s, i) => s + i.usoCount, 0),
      })
    }
    // Mismo código, distinto precio
    const allPrices = [...new Set(items.flatMap((i) => i.valorHoraVariantes))]
    if (allPrices.length > 1) {
      report.mismoCodDistintoPrecio.push({
        codigo: cod,
        precios: allPrices,
        count: items.reduce((s, i) => s + i.usoCount, 0),
      })
    }
  }

  // Detectar descripciones duplicadas
  const byNombre = new Map<string, ServiceNormalized[]>()
  for (const s of services) {
    const k = normStr(s.nombre)
    if (!byNombre.has(k)) byNombre.set(k, [])
    byNombre.get(k)!.push(s)
  }
  for (const [, items] of byNombre) {
    if (items.length > 1) {
      report.descripcionesDuplicadas.push({
        nombre: items[0].nombre,
        codigos: items.map((i) => i.codigo ?? '(sin código)'),
        count: items.length,
      })
    }
  }

  return report
}

// ─── Generar informe de calidad en Markdown ───────────────────────────────────

function generateQualityMarkdown(
  report: ServiceQualityReport,
  services: ServiceNormalized[],
  packages: PackageNormalized[],
  discovery: EndpointResult[],
  otsSampled: OtSummary[],
  calcExamples: CalcExample[],
  valorHoraAnalysis: Record<number, { count: number; employees: Set<string>; services: string[] }>
): string {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19)

  const availEPs = discovery.filter((d) => d.available)
  const unavailEPs = discovery.filter((d) => !d.available)
  const verifiedCalc = calcExamples.filter((e) => e.calculoVerificado).length

  const sortedVH = Object.entries(valorHoraAnalysis)
    .map(([vh, info]) => ({ vh: Number(vh), count: info.count, employees: [...info.employees], services: info.services }))
    .sort((a, b) => b.count - a.count)

  const topServices = services.slice(0, 30)
  const topPackages = packages.slice(0, 20)

  return `# Informe de Auditoría — Catálogo de Servicios TallerGP

Generado: ${ts}

---

## Resumen ejecutivo

| Métrica | Valor |
|---|---|
| OTs analizadas | **${otsSampled.length}** |
| Total OTs en sistema | ${otsSampled.length > 0 ? '(ver endpoints)' : 'N/A'} |
| Servicios únicos detectados | **${report.totalServicios}** |
| Paquetes únicos detectados | **${report.totalPaquetes}** |
| Cálculo verificado | ${verifiedCalc}/${calcExamples.length} (${calcExamples.length > 0 ? Math.round(verifiedCalc / calcExamples.length * 100) : 0}%) |

---

## FASE 1 — Endpoints disponibles

### Disponibles (${availEPs.length})

| Endpoint | Status | Total | Paginado |
|---|---|---|---|
${availEPs.map((e) => `| ${e.endpoint} | ${e.status} | ${e.total ?? '?'} | ${e.paginated ? 'Sí' : 'No'} |`).join('\n')}

### No disponibles (${unavailEPs.length})

${unavailEPs.map((e) => `- \`${e.endpoint}\` → HTTP ${e.status}`).join('\n')}

---

## FASE 4 — Fórmula de mano de obra

### Fórmula confirmada

\`\`\`
total_linea = quantity × unit_price_net × (1 − discount_percentage / 100)
\`\`\`

- \`quantity\` = número de horas (decimal: 0.5 = 30 min, 1.0 = 1 hora)
- \`unit_price_net\` = precio por hora (valor hora del taller)
- Fórmula verificada en **${verifiedCalc}/${calcExamples.length}** líneas analizadas

### Valores hora encontrados

| Valor/hora (CLP) | Usos | Empleados | Servicios |
|---|---|---|---|
${sortedVH.slice(0, 15).map((v) =>
  `| $${v.vh.toLocaleString('es-CL')} | ${v.count} | ${v.employees.slice(0, 5).join(', ')} | ${v.services.slice(0, 3).join(', ')} |`
).join('\n')}

### Respuestas a preguntas clave

1. **¿La mano de obra se calcula siempre por horas?** Sí, cuando hay labor con quantity > 0
2. **¿Dónde está la cantidad de horas?** En el campo \`quantity\` de la línea de labor
3. **¿Dónde está el valor hora?** En \`unit_price_net\` de cada línea
4. **¿El valor hora es constante?** ${sortedVH.length === 1 ? 'Sí, un único valor en la muestra' : `Hay ${sortedVH.length} valores distintos — ver tabla`}
5. **¿El precio es neto o bruto?** Neto — IVA (19%) se agrega al total de la OT
6. **¿Cómo se aplican descuentos?** Por línea (\`discount_percentage\`) y también via \`other[]\` con qty=-1
7. **¿Cómo se comportan servicios gratuitos?** discount_percentage=100% → total=0

### Ejemplos reales

| OT | Servicio | Horas | Valor/Hora | Dto% | Total | Verificado |
|---|---|---|---|---|---|---|
${calcExamples.slice(0, 20).map((e) =>
  `| ${e.otNumber} | ${e.description.slice(0, 40)} | ${e.horas} | $${e.valorHora.toLocaleString('es-CL')} | ${e.descuentoPct}% | $${e.totalReal.toLocaleString('es-CL')} | ${e.calculoVerificado ? '✓' : `✗ (${e.nota})`} |`
).join('\n')}

---

## FASE 5 — Catálogo de servicios

### Resumen de calidad

| Métrica | Valor |
|---|---|
| Total servicios | **${report.totalServicios}** |
| Con código | ${report.conCodigo} (${Math.round(report.conCodigo / report.totalServicios * 100)}%) |
| Sin código | ${report.sinCodigo} |
| Con horas estándar | ${report.conHoras} |
| Sin horas | ${report.sinHoras} |
| Con precio | ${report.conPrecio} |
| Sin precio | ${report.sinPrecio} |
| Usados >1 vez | ${report.usadosMasDeUnaVez} |
| Usados solo 1 vez | ${report.usadosSoloUnaVez} |
| En paquetes | ${report.enPaquetes} |
| Códigos duplicados | ${report.codigosDuplicados.length} |
| Descripciones dup. | ${report.descripcionesDuplicadas.length} |
| Mismo código/horas dif. | ${report.mismoCodDistintasHoras.length} |
| Servicios gratuitos | ${report.serviciosGratuitos.length} |

### Top 30 servicios por frecuencia de uso

| # | Código | Nombre | Horas std | Valor/Hr | Usos | En pkg |
|---|---|---|---|---|---|---|
${topServices.map((s, i) =>
  `| ${i + 1} | ${s.codigo ?? '—'} | ${s.nombre.slice(0, 45)} | ${s.horasEstandar ?? '—'} | ${s.valorHora ? '$' + s.valorHora.toLocaleString('es-CL') : '—'} | ${s.usoCount} | ${s.esParte_dePaquete ? '✓ ' + s.paqueteCodigos.join(',') : '—'} |`
).join('\n')}

${report.codigosDuplicados.length > 0 ? `
### Códigos duplicados (requieren revisión)

${report.codigosDuplicados.map((d) =>
  `- **${d.codigo}** → ${d.variantes} variantes: ${d.nombres.map((n) => `"${n}"`).join(', ')}`
).join('\n')}
` : ''}

${report.mismoCodDistintasHoras.length > 0 ? `
### Mismo código con horas distintas

${report.mismoCodDistintasHoras.map((d) =>
  `- **${d.codigo}** → horas: [${d.horas.join(', ')}] (${d.count} usos totales)`
).join('\n')}
` : ''}

---

## Paquetes detectados

### Resumen

| Métrica | Valor |
|---|---|
| Total paquetes | **${report.totalPaquetes}** |
| Con items | ${report.paquetesConItems} |
| Frecuentes (≥3 usos) | ${report.paquetesFrecuentes.length} |
| De inspección/revisión | ${report.paquetesDeInspeccion.length} |
| Con repuestos incluidos | ${report.paquetesConRepuestos.length} |

### Top 20 paquetes

| # | Código | Nombre | Items | Horas | M.O. | Usos |
|---|---|---|---|---|---|---|
${topPackages.map((p, i) =>
  `| ${i + 1} | ${p.codigo} | ${p.nombre.slice(0, 40)} | ${p.items.length} | ${p.totalHorasEstimado.toFixed(1)} | $${p.totalManoObraEstimado.toLocaleString('es-CL')} | ${p.usoCount} |`
).join('\n')}

${packages.filter((p) => p.items.length > 0).slice(0, 5).map((p) => `
### Paquete: ${p.codigo} — "${p.nombre}"

**Usos:** ${p.usoCount} | **Total horas:** ${p.totalHorasEstimado.toFixed(1)} | **M.O. estimada:** $${p.totalManoObraEstimado.toLocaleString('es-CL')}

| Tipo | Código | Nombre | Qty/Hrs | Precio |
|---|---|---|---|---|
${p.items.map((i) =>
  `| ${i.tipo} | ${i.codigo ?? '—'} | ${i.nombre.slice(0, 45)} | ${i.tipo === 'labor' ? `${i.horas}h` : i.cantidad} | $${i.precioNeto.toLocaleString('es-CL')} |`
).join('\n')}
`).join('\n')}

---

## Conclusión: ¿Se pueden recuperar las manos de obra y paquetes?

${report.totalServicios > 0 ? `
**RESPUESTA: ${report.totalServicios >= 20 ? 'B — Sí, reconstruyendo desde órdenes históricas.' : 'C — Parcialmente, con limpieza manual.'}**

- **${report.totalServicios} servicios únicos** recuperados de ${otsSampled.length} OTs analizadas
- **${report.totalPaquetes} paquetes** detectados
- Con código: ${report.conCodigo}/${report.totalServicios} (${Math.round(report.conCodigo / report.totalServicios * 100)}%)
- Con horas estándar: ${report.conHoras}/${report.totalServicios}
- Fórmula de cálculo verificada: ${calcExamples.length > 0 ? Math.round(verifiedCalc / calcExamples.length * 100) + '%' : 'N/A'}

**Calidad de recuperación:** ${
  report.conCodigo / report.totalServicios > 0.7
    ? 'ALTA — Mayoría de servicios tienen código único'
    : report.conCodigo / report.totalServicios > 0.4
    ? 'MEDIA — Aprox. mitad con código, resto requiere normalización por texto'
    : 'BAJA — Pocos códigos únicos, requiere limpieza manual'
}

**Limitación:** Esta muestra cubre ${otsSampled.length} de las 5,449 OTs totales.
Analizando más OTs se recuperarían más servicios del catálogo histórico.
` : `
**RESULTADO PENDIENTE** — No se pudieron extraer líneas de labor.
Verificar autenticación y acceso a \`/repair-orders/{id}\`.
`}

---

## Recomendación de importación

1. **NO importar todavía** — datos recuperados son de historial, requieren revisión manual
2. **Limpiar** nombres duplicados y servicios de una sola vez de bajo valor
3. **Confirmar** valor hora con el taller (¿único o por mecánico/tipo?)
4. **Construir** Migration 005 con \`catalogo_servicios\` + \`trabajo_ot\`
5. **Importar** usando script idempotente con upsert por código

---

## Próximo prompt recomendado

> Sprint 10 — Migration 005: catalogo_servicios + trabajo_ot
>
> Basado en el informe tmp/tallergp/services-audit/services-quality-report.md,
> crear migración 005 con tablas catalogo_servicios y trabajo_ot.
> Seed inicial desde services-normalized.json (solo servicios con usoCount >= 2 y codigo no null).
> No importar todavía paquetes. No tocar inventario existente.
`
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║  All Motors — Audit Services (solo lectura)      ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  console.log(`  Directorio de salida: ${OUT_DIR}`)
  console.log(`  Max OTs a analizar: ${MAX_OTS}`)

  // Verificar autenticación
  try {
    await getBearerToken()
    console.log('  Autenticación OK ✓\n')
  } catch (err) {
    console.error('  ✗ Error de autenticación:', (err as Error).message)
    console.error('  Revisa migration-toolkit/.env — necesitas TALLERGP_ACCESS_TOKEN')
    process.exit(1)
  }

  const client = getClient()

  // ── FASE 1: Discovery ─────────────────────────────────────────────────────
  let discoveryResults: EndpointResult[] = []
  if (!SKIP_DISC) {
    discoveryResults = await fase1Discovery(client)
    saveJson('endpoints-discovery.json', discoveryResults)
  } else {
    console.log('\n  FASE 1 omitida (--skip-discovery)')
    discoveryResults = []
  }

  // ── FASE 2: Catálogos directos ────────────────────────────────────────────
  const { laborDirect, servicesDirect, packagesDirect } = await fase2DirectCatalog(client, discoveryResults)

  // ── FASE 3: Reconstruir desde OTs ─────────────────────────────────────────
  const { laborLines, otsSampled, partsLines, packageHeaders } = await fase3ReconstructFromOTs(MAX_OTS)

  // Guardar muestra de OTs analizadas
  saveJson('repair-orders-sample.json', {
    totalAnalizadas: otsSampled.length,
    totalLaborLines: laborLines.length,
    otsRecientes: otsSampled.slice(0, 20),
  })

  // ── FASE 4: Ingeniería inversa ────────────────────────────────────────────
  const { examples: calcExamples, valorHoraAnalysis } = fase4CalcExamples(laborLines)
  saveJson('labor-calculation-examples.json', calcExamples)

  // ── FASE 5: Normalizar y deduplicar ──────────────────────────────────────
  const { services, packages } = fase5Normalize(laborLines, packageHeaders, partsLines)

  // Guardar normalizados
  saveJson('services-normalized.json', services)
  saveJson('packages-normalized.json', packages)

  // Items de paquetes
  const allPackageItems = packages.flatMap((p) =>
    p.items.map((item) => ({ paqueteCodigo: p.codigo, paqueteNombre: p.nombre, ...item }))
  )
  saveJson('package-items-normalized.json', allPackageItems)

  // Candidatos a fusión (misma descripción, distintos códigos)
  const qualityReport = fase5QualityAnalysis(services, packages)
  const dedupeCandidates = [
    ...qualityReport.descripcionesDuplicadas.map((d) => ({
      tipo: 'descripcion_duplicada',
      nombre: d.nombre,
      codigos: d.codigos,
      count: d.count,
    })),
    ...qualityReport.mismoCodDistintasHoras.map((d) => ({
      tipo: 'mismo_codigo_horas_distintas',
      codigo: d.codigo,
      horasVariantes: d.horas,
      usosTotales: d.count,
    })),
  ]
  saveJson('services-dedupe-candidates.json', dedupeCandidates)

  // ── FASE 6: Informes Markdown ──────────────────────────────────────────────
  const valorHoraForMd: Record<number, { count: number; employees: Set<string>; services: string[] }> = {}
  for (const [key, val] of Object.entries(valorHoraAnalysis)) {
    valorHoraForMd[Number(key)] = val
  }

  const qualityMd = generateQualityMarkdown(
    qualityReport,
    services,
    packages,
    discoveryResults,
    otsSampled,
    calcExamples,
    valorHoraForMd
  )
  saveMarkdown('services-quality-report.md', qualityMd)

  // ── Modelo recomendado ────────────────────────────────────────────────────
  const importRecommendation = `# Recomendación de Importación — Mano de Obra TallerGP

Generado: ${new Date().toISOString().slice(0, 10)}

## Datos recuperados

- **${services.length} servicios únicos** desde ${otsSampled.length} OTs analizadas
- **${packages.length} paquetes** reconstruidos
- Servicios con código: ${qualityReport.conCodigo}/${qualityReport.totalServicios}
- Servicios con horas estándar: ${qualityReport.conHoras}/${qualityReport.totalServicios}

## Modelo recomendado

### catalogo_servicios
\`\`\`sql
CREATE TABLE catalogo_servicios (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizaciones(id),
  codigo        TEXT,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  categoria     TEXT,
  horas_estandar NUMERIC(6,2),
  valor_hora_default INTEGER,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  fuente        TEXT DEFAULT 'manual',
  external_id   TEXT,
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  eliminado_en  TIMESTAMPTZ,
  UNIQUE (org_id, codigo)
);
\`\`\`

### plantillas_trabajo (paquetes)
\`\`\`sql
CREATE TABLE plantillas_trabajo (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id        UUID NOT NULL REFERENCES organizaciones(id),
  codigo        TEXT,
  nombre        TEXT NOT NULL,
  descripcion   TEXT,
  categoria     TEXT,
  activo        BOOLEAN NOT NULL DEFAULT TRUE,
  fuente        TEXT DEFAULT 'manual',
  external_id   TEXT,
  creado_en     TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en TIMESTAMPTZ DEFAULT NOW(),
  eliminado_en  TIMESTAMPTZ
);
\`\`\`

### items_plantilla
\`\`\`sql
CREATE TABLE items_plantilla (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plantilla_id    UUID NOT NULL REFERENCES plantillas_trabajo(id) ON DELETE CASCADE,
  tipo            TEXT NOT NULL CHECK (tipo IN ('labor', 'material', 'service', 'unknown')),
  servicio_id     UUID REFERENCES catalogo_servicios(id),
  repuesto_id     UUID REFERENCES repuestos(id),
  codigo_externo  TEXT,
  nombre          TEXT NOT NULL,
  cantidad        NUMERIC(10,3) NOT NULL DEFAULT 1,
  horas           NUMERIC(6,2),
  orden           INTEGER DEFAULT 0,
  obligatorio     BOOLEAN DEFAULT TRUE
);
\`\`\`

### trabajo_ot
\`\`\`sql
CREATE TABLE trabajo_ot (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id           UUID NOT NULL,
  orden_trabajo_id UUID NOT NULL REFERENCES ordenes_trabajo(id) ON DELETE CASCADE,
  servicio_id      UUID REFERENCES catalogo_servicios(id),
  descripcion      TEXT NOT NULL,
  referencia       TEXT,
  mecanico_id      UUID REFERENCES usuarios(id),
  horas_estimadas  NUMERIC(6,2),
  horas_reales     NUMERIC(6,2),
  valor_hora       INTEGER NOT NULL DEFAULT 0,
  descuento_pct    NUMERIC(5,2) NOT NULL DEFAULT 0,
  precio_mano_obra INTEGER GENERATED ALWAYS AS (
    ROUND(horas_estimadas * valor_hora * (1 - descuento_pct / 100))
  ) STORED,
  estado           TEXT NOT NULL DEFAULT 'pendiente',
  inicio           TIMESTAMPTZ,
  termino          TIMESTAMPTZ,
  creado_en        TIMESTAMPTZ DEFAULT NOW(),
  actualizado_en   TIMESTAMPTZ DEFAULT NOW()
);
\`\`\`

### configuracion_mano_obra
\`\`\`sql
CREATE TABLE configuracion_mano_obra (
  org_id                   UUID PRIMARY KEY REFERENCES organizaciones(id),
  valor_hora_mecanica      INTEGER NOT NULL DEFAULT 0,
  valor_hora_diagnostico   INTEGER,
  valor_hora_electricidad  INTEGER,
  valor_hora_diesel        INTEGER,
  moneda                   TEXT DEFAULT 'CLP',
  iva_porcentaje           NUMERIC(5,2) DEFAULT 19
);
\`\`\`

## Estrategia de importación futura (syncTallerGpLaborAndPackages)

### Servicios
1. Filtrar: usoCount >= 2 Y codigo IS NOT NULL
2. upsert por (org_id, codigo) — update nombre/horas_estandar si cambió
3. Log de servicios ignorados (usoCount < 2 o sin código)

### Paquetes
1. Filtrar: usoCount >= 2 Y codigo IS NOT NULL
2. upsert por (org_id, codigo) — delete + re-insert items
3. Vincular items a servicio_id si existe en catalogo_servicios

### Configuración mano de obra
- Insertar valor_hora_mecanica con el valor hora más frecuente encontrado
- Requiere confirmación manual del taller antes de aplicar
`
  saveMarkdown('import-recommendation.md', importRecommendation)

  // ── Resumen final ─────────────────────────────────────────────────────────
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║  RESUMEN FINAL                                   ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  OTs analizadas:          ${otsSampled.length}`)
  console.log(`  Líneas de labor totales: ${laborLines.length}`)
  console.log(`  Servicios únicos:        ${services.length}`)
  console.log(`  Paquetes únicos:         ${packages.length}`)
  console.log(`  Con código:              ${qualityReport.conCodigo}/${qualityReport.totalServicios}`)
  console.log(`  Con horas estándar:      ${qualityReport.conHoras}/${qualityReport.totalServicios}`)

  const vhKeys = Object.keys(valorHoraAnalysis)
  if (vhKeys.length > 0) {
    const topVH = Object.entries(valorHoraAnalysis).sort(([, a], [, b]) => b.count - a.count)[0]
    console.log(`  Valor hora más común:    $${Number(topVH[0]).toLocaleString('es-CL')}/hr (${topVH[1].count} usos)`)
  }

  const calcVerif = calcExamples.filter((e) => e.calculoVerificado).length
  if (calcExamples.length > 0) {
    console.log(`  Fórmula verificada:      ${calcVerif}/${calcExamples.length} (${Math.round(calcVerif / calcExamples.length * 100)}%)`)
  }

  console.log(`\n  Archivos generados en: ${OUT_DIR}`)
  console.log('  - endpoints-discovery.json')
  console.log('  - repair-orders-sample.json')
  console.log('  - services-normalized.json')
  console.log('  - services-dedupe-candidates.json')
  console.log('  - packages-normalized.json')
  console.log('  - package-items-normalized.json')
  console.log('  - labor-calculation-examples.json')
  console.log('  - services-quality-report.md')
  console.log('  - import-recommendation.md')

  const answer =
    services.length >= 20
      ? 'B — Sí, reconstruyendo desde órdenes históricas.'
      : services.length >= 5
      ? 'C — Parcialmente, con limpieza manual.'
      : 'D — Muestra insuficiente. Ejecutar con más OTs.'

  console.log(`\n  ¿Se pueden recuperar las manos de obra? ${answer}`)
  console.log('\n✅ Auditoría completada.\n')
}

main().catch((err) => {
  console.error('\n✗ Error fatal:', (err as Error).message)
  process.exit(1)
})

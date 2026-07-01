/**
 * analyze-cached-services.ts
 *
 * Analiza datos de OTs ya descargados en exports/raw/ sin hacer requests API.
 * Genera todos los archivos de output en tmp/tallergp/services-audit/
 *
 * Uso:
 *   cd migration-toolkit
 *   npx tsx src/scripts/analyze-cached-services.ts
 */

import 'dotenv/config'
import { writeFileSync, mkdirSync, existsSync, readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'

// ─── Paths ────────────────────────────────────────────────────────────────────

const OUT_DIR = resolve('../tmp/tallergp/services-audit')
mkdirSync(OUT_DIR, { recursive: true })

function saveJson(name: string, data: unknown): void {
  const p = join(OUT_DIR, name)
  writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`  ✓ ${p}`)
}

function saveMarkdown(name: string, content: string): void {
  const p = join(OUT_DIR, name)
  writeFileSync(p, content, 'utf-8')
  console.log(`  ✓ ${p}`)
}

function safeNum(v: unknown): number {
  if (typeof v === 'number') return v
  if (typeof v === 'string') { const n = parseFloat(v); return isNaN(n) ? 0 : n }
  return 0
}

function normStr(s: unknown): string {
  if (typeof s !== 'string') return ''
  return s.trim().toUpperCase()
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface OtMeta {
  entryId: string
  orderNumber: string
  date: string
  plate: string
  isClosed: boolean
}

// ─── Cargar y parsear OTs cacheadas ─────────────────────────────────────────

function extractLinesFromOT(
  raw: Record<string, unknown>,
  otMeta: OtMeta
): {
  labor: LaborLine[]
  packageHeaders: unknown[]
  partsInPkgs: unknown[]
  allParts: unknown[]
} {
  const labor: LaborLine[] = []
  const packageHeaders: unknown[] = []
  const partsInPkgs: unknown[] = []
  const allParts: unknown[] = []

  if (Array.isArray(raw.lines_package_parents)) {
    for (const ph of raw.lines_package_parents as Record<string, unknown>[]) {
      packageHeaders.push({ ...ph, _otId: otMeta.entryId, _otNumber: otMeta.orderNumber })
    }
  }

  if (Array.isArray(raw.labor)) {
    for (const line of raw.labor as Record<string, unknown>[]) {
      labor.push({
        reference: typeof line.reference === 'string' && line.reference ? line.reference : null,
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
        otId: otMeta.entryId,
        otNumber: otMeta.orderNumber,
        otDate: otMeta.date,
      })
    }
  }

  if (Array.isArray(raw.parts)) {
    for (const line of raw.parts as Record<string, unknown>[]) {
      allParts.push({ ...line, _otId: otMeta.entryId, _otNumber: otMeta.orderNumber })
      if (line.package_id) {
        partsInPkgs.push({ ...line, _otId: otMeta.entryId, _otNumber: otMeta.orderNumber })
      }
    }
  }

  return { labor, packageHeaders, partsInPkgs, allParts }
}

// ─── Normalizar servicios ─────────────────────────────────────────────────────

function normalizeKey(ref: string | null, desc: string): string {
  if (ref?.trim()) return ref.trim().toUpperCase()
  return normStr(desc).replace(/\s+/g, '_').slice(0, 60)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main(): void {
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║  Analyze Cached Services (sin requests API)      ║')
  console.log('╚══════════════════════════════════════════════════╝\n')

  const rawDir = resolve('./exports/raw')
  if (!existsSync(rawDir)) {
    console.error(`  ✗ No existe: ${rawDir}`)
    process.exit(1)
  }

  // También cargar checkpoint si existe
  const checkpointPath = join(OUT_DIR, '_checkpoint.json')
  let checkpointLaborLines: LaborLine[] = []
  let checkpointPackageHeaders: unknown[] = []
  let checkpointPartsLines: unknown[] = []
  let checkpointOtIds: Set<string> = new Set()

  if (existsSync(checkpointPath)) {
    try {
      const cp = JSON.parse(readFileSync(checkpointPath, 'utf-8')) as {
        processedIds?: string[]
        laborLines?: LaborLine[]
        packageHeaders?: unknown[]
        partsLines?: unknown[]
      }
      checkpointLaborLines = cp.laborLines ?? []
      checkpointPackageHeaders = cp.packageHeaders ?? []
      checkpointPartsLines = cp.partsLines ?? []
      checkpointOtIds = new Set(cp.processedIds ?? [])
      console.log(`  ✓ Checkpoint cargado: ${checkpointOtIds.size} OTs, ${checkpointLaborLines.length} labor lines`)
    } catch {
      console.log('  ⚠ Checkpoint corrupto — ignorando')
    }
  }

  // Cargar OTs raw de disco
  const rawFiles = readdirSync(rawDir).filter(
    (f) => f.includes('repair_order') && f.includes('_detail') && f.endsWith('.json')
  )

  console.log(`\n  Archivos raw encontrados: ${rawFiles.length}`)

  const allLaborLines: LaborLine[] = [...checkpointLaborLines]
  const allPackageHeaders: unknown[] = [...checkpointPackageHeaders]
  const allPartsInPkgs: unknown[] = [...checkpointPartsLines]
  const allParts: unknown[] = []
  const otsMetadata: OtMeta[] = []

  for (const fname of rawFiles) {
    try {
      const raw = JSON.parse(readFileSync(join(rawDir, fname), 'utf-8')) as Record<string, unknown>
      const entryId = String(raw.entry_id ?? '')

      // Evitar duplicados con checkpoint
      if (checkpointOtIds.has(entryId)) {
        console.log(`  (checkpoint) ${raw.order_number} ya incluida`)
        continue
      }

      const meta: OtMeta = {
        entryId,
        orderNumber: String(raw.order_number ?? ''),
        date: String(raw.entry_date ?? ''),
        plate: String(raw.plate ?? ''),
        isClosed: !!raw.is_closed,
      }
      otsMetadata.push(meta)

      const { labor, packageHeaders, partsInPkgs, allParts: parts } = extractLinesFromOT(raw, meta)
      allLaborLines.push(...labor)
      allPackageHeaders.push(...packageHeaders)
      allPartsInPkgs.push(...partsInPkgs)
      allParts.push(...parts)

      console.log(`  ✓ ${meta.orderNumber} — ${labor.length} labor lines, ${packageHeaders.length} pkg headers`)
    } catch (err) {
      console.log(`  ⚠ Error en ${fname}: ${(err as Error).message}`)
    }
  }

  // Contar OTs totales (raw + checkpoint)
  const totalOTs = otsMetadata.length + checkpointOtIds.size
  console.log(`\n  Total OTs analizadas: ${totalOTs}`)
  console.log(`  Total labor lines: ${allLaborLines.length}`)
  console.log(`  Total package headers: ${allPackageHeaders.length}`)
  console.log(`  Total parts en paquetes: ${allPartsInPkgs.length}`)

  // ── Agrupar por servicio ──────────────────────────────────────────────────
  console.log('\n  Normalizando servicios...')

  interface ServiceAcc {
    externalId: string
    codigo: string | null
    nombre: string
    horasVariantes: Set<number>
    valorHoraVariantes: Set<number>
    descuentos: number[]
    usoCount: number
    usadoEnOts: Set<string>
    esParte_dePaquete: boolean
    paqueteCodigos: Set<string>
    lines: LaborLine[]
  }

  const serviceMap = new Map<string, ServiceAcc>()

  for (const line of allLaborLines) {
    const key = normalizeKey(line.reference, line.description)

    if (!serviceMap.has(key)) {
      serviceMap.set(key, {
        externalId: key,
        codigo: line.reference ? line.reference.trim() : null,
        nombre: line.description,
        horasVariantes: new Set(),
        valorHoraVariantes: new Set(),
        descuentos: [],
        usoCount: 0,
        usadoEnOts: new Set(),
        esParte_dePaquete: false,
        paqueteCodigos: new Set(),
        lines: [],
      })
    }

    const svc = serviceMap.get(key)!
    svc.usoCount++
    svc.usadoEnOts.add(line.otNumber)
    svc.descuentos.push(line.discountPct)

    if (line.packageId) {
      svc.esParte_dePaquete = true
      const pkgRef = line.packageReference ?? line.packageId
      svc.paqueteCodigos.add(pkgRef)
    }

    const isSubItem = line.packageId !== null && line.quantity === 0 && line.unitPriceNet === 0
    if (!isSubItem) {
      if (line.quantity > 0) svc.horasVariantes.add(line.quantity)
      if (line.unitPriceNet > 0) svc.valorHoraVariantes.add(line.unitPriceNet)
    }

    svc.lines.push(line)
  }

  // Calcular modo para horas y valor hora
  const services = [...serviceMap.values()].map((svc) => {
    const horasArr = [...svc.horasVariantes].sort((a, b) => a - b)
    const valorHoraArr = [...svc.valorHoraVariantes].sort((a, b) => b - a)
    const horasEstandar = horasArr.length > 0
      ? (() => {
          const freq = new Map<number, number>()
          for (const h of horasArr) freq.set(h, (freq.get(h) ?? 0) + 1)
          return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
        })()
      : null
    const valorHora = valorHoraArr.length > 0
      ? (() => {
          const freq = new Map<number, number>()
          for (const v of valorHoraArr) freq.set(v, (freq.get(v) ?? 0) + 1)
          return [...freq.entries()].sort((a, b) => b[1] - a[1])[0][0]
        })()
      : null
    const precioNeto = horasEstandar !== null && valorHora !== null
      ? Math.round(horasEstandar * valorHora)
      : null
    const descuentoPromedio = svc.descuentos.length > 0
      ? Math.round(svc.descuentos.reduce((a, b) => a + b, 0) / svc.descuentos.length)
      : 0

    return {
      externalId: svc.externalId,
      codigo: svc.codigo,
      nombre: svc.nombre,
      descripcion: null as string | null,
      categoria: null as string | null,
      horasEstandar,
      horasVariantes: horasArr,
      valorHora,
      valorHoraVariantes: valorHoraArr,
      precioNeto,
      descuentoPromedio,
      usoCount: svc.usoCount,
      usadoEnOts: [...svc.usadoEnOts],
      esParte_dePaquete: svc.esParte_dePaquete,
      paqueteCodigos: [...svc.paqueteCodigos],
      activo: true,
      fuente: 'ot_history',
    }
  }).sort((a, b) => b.usoCount - a.usoCount)

  // ── Reconstruir paquetes ──────────────────────────────────────────────────
  console.log('  Reconstruyendo paquetes...')

  interface PkgAcc {
    externalId: string
    codigo: string
    nombre: string
    laborItems: LaborLine[]
    partsItems: unknown[]
    usadoEnOts: Set<string>
  }

  const pkgMap = new Map<string, PkgAcc>()

  // Registrar desde headers
  for (const ph of allPackageHeaders as Record<string, unknown>[]) {
    const ref = String(ph.reference ?? ph.package_id ?? '').trim()
    const desc = String(ph.description ?? ref).trim()
    if (!ref) continue

    if (!pkgMap.has(ref)) {
      pkgMap.set(ref, {
        externalId: String(ph.package_id ?? ref),
        codigo: ref,
        nombre: desc,
        laborItems: [],
        partsItems: [],
        usadoEnOts: new Set(),
      })
    }
    const otNum = String(ph._otNumber ?? '')
    if (otNum) pkgMap.get(ref)!.usadoEnOts.add(otNum)
  }

  // Agregar labor a paquetes
  for (const line of allLaborLines) {
    if (!line.packageReference) continue
    const ref = line.packageReference.trim()
    if (!pkgMap.has(ref)) {
      pkgMap.set(ref, {
        externalId: line.packageId ?? ref,
        codigo: ref,
        nombre: ref,
        laborItems: [],
        partsItems: [],
        usadoEnOts: new Set([line.otNumber]),
      })
    }
    const pkg = pkgMap.get(ref)!
    pkg.usadoEnOts.add(line.otNumber)
    // Deduplicar por reference+description
    const exists = pkg.laborItems.some(
      (i) => i.reference === line.reference && i.description === line.description
    )
    if (!exists) pkg.laborItems.push(line)
  }

  // Agregar parts a paquetes
  for (const part of allPartsInPkgs as Record<string, unknown>[]) {
    const ref = String(part.package_reference ?? part.package_id ?? '').trim()
    if (!ref || !pkgMap.has(ref)) continue
    const pkg = pkgMap.get(ref)!
    const exists = pkg.partsItems.some(
      (i: unknown) => (i as Record<string, unknown>).reference === part.reference && (i as Record<string, unknown>).package_line_type === '2'
    )
    if (!exists) pkg.partsItems.push(part)
  }

  const packages = [...pkgMap.values()].map((pkg) => {
    const laborItems = pkg.laborItems.map((l) => ({
      tipo: 'labor' as const,
      codigo: l.reference,
      nombre: l.description,
      descripcion: null,
      cantidad: l.quantity,
      horas: l.quantity,
      valorHora: l.unitPriceNet,
      precioNeto: l.totalNet,
      materialCodigo: null,
      packageLineType: l.packageLineType,
    }))

    const partsItems = (pkg.partsItems as Record<string, unknown>[]).map((p) => ({
      tipo: 'material' as const,
      codigo: typeof p.reference === 'string' ? p.reference : null,
      nombre: String(p.description ?? ''),
      descripcion: null,
      cantidad: safeNum(p.quantity),
      horas: 0,
      valorHora: 0,
      precioNeto: safeNum(p.total_line_amount_net_calculated),
      materialCodigo: typeof p.reference === 'string' ? p.reference : null,
      packageLineType: typeof p.package_line_type === 'string' ? p.package_line_type : null,
    }))

    const allItems = [...laborItems, ...partsItems]
    const totalHoras = laborItems.reduce((s, i) => s + i.horas, 0)

    // La línea de mano de obra del paquete es la de type="2" en parts
    const billablePart = partsItems.find((i) => i.packageLineType === '2')
    const totalMoEstimado = billablePart ? billablePart.precioNeto : laborItems.reduce((s, i) => s + i.precioNeto, 0)
    const totalRepEstimado = partsItems.filter((i) => i.packageLineType !== '2').reduce((s, i) => s + i.precioNeto, 0)

    return {
      externalId: pkg.externalId,
      codigo: pkg.codigo,
      nombre: pkg.nombre,
      descripcion: null as string | null,
      categoria: null as string | null,
      items: allItems,
      totalHorasEstimado: totalHoras,
      totalManoObraEstimado: totalMoEstimado,
      totalRepuestosEstimado: totalRepEstimado,
      usoCount: pkg.usadoEnOts.size,
      usadoEnOts: [...pkg.usadoEnOts],
      activo: true,
      fuente: 'ot_history',
    }
  }).sort((a, b) => b.usoCount - a.usoCount)

  // ── Ejemplos de cálculo ───────────────────────────────────────────────────
  console.log('  Generando ejemplos de cálculo...')

  const calcExamples = allLaborLines
    .filter((l) => l.quantity > 0 && l.unitPriceNet > 0)
    .slice(0, 50)
    .map((l) => {
      const calc = Math.round(l.quantity * l.unitPriceNet * (1 - l.discountPct / 100))
      const real = Math.round(l.totalNet)
      return {
        otNumber: l.otNumber,
        description: l.description,
        reference: l.reference,
        horas: l.quantity,
        valorHora: l.unitPriceNet,
        descuentoPct: l.discountPct,
        totalEsperado: calc,
        totalReal: real,
        calculoVerificado: Math.abs(calc - real) <= 1,
        diferencia: Math.abs(calc - real),
        empleado: l.employeeNumber,
      }
    })

  // ── Análisis de valores hora ──────────────────────────────────────────────
  const valorHoraMap = new Map<number, { count: number; employees: Set<string>; servicios: string[] }>()
  for (const l of allLaborLines.filter((l) => l.quantity > 0 && l.unitPriceNet > 0)) {
    const vh = l.unitPriceNet
    if (!valorHoraMap.has(vh)) valorHoraMap.set(vh, { count: 0, employees: new Set(), servicios: [] })
    const entry = valorHoraMap.get(vh)!
    entry.count++
    if (l.employeeNumber) entry.employees.add(l.employeeNumber)
    if (l.reference && !entry.servicios.includes(l.reference)) entry.servicios.push(l.reference)
  }
  const valorHoraRanking = [...valorHoraMap.entries()]
    .map(([vh, d]) => ({ valorHora: vh, count: d.count, empleados: [...d.employees], servicios: d.servicios.slice(0, 5) }))
    .sort((a, b) => b.count - a.count)

  // ── Candidatos a fusión ───────────────────────────────────────────────────
  const byNombre = new Map<string, typeof services>()
  for (const s of services) {
    const k = normStr(s.nombre)
    if (!byNombre.has(k)) byNombre.set(k, [])
    byNombre.get(k)!.push(s)
  }
  const descripcionesDup = [...byNombre.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({ nombre: g[0].nombre, codigos: g.map((s) => s.codigo ?? '(sin código)'), count: g.length }))

  const byCodigo = new Map<string, typeof services>()
  for (const s of services) {
    if (!s.codigo) continue
    if (!byCodigo.has(s.codigo)) byCodigo.set(s.codigo, [])
    byCodigo.get(s.codigo)!.push(s)
  }
  const codigosDup = [...byCodigo.values()]
    .filter((g) => g.length > 1)
    .map((g) => ({ codigo: g[0].codigo!, variantes: g.length, nombres: g.map((s) => s.nombre) }))

  const mismoCodDistintasHoras = [...byCodigo.entries()]
    .filter(([, g]) => {
      const allHoras = [...new Set(g.flatMap((s) => s.horasVariantes))]
      return allHoras.length > 1
    })
    .map(([cod, g]) => ({
      codigo: cod,
      horas: [...new Set(g.flatMap((s) => s.horasVariantes))],
      usosTotales: g.reduce((sum, s) => sum + s.usoCount, 0),
    }))

  const dedupeCandidates = [
    ...descripcionesDup.map((d) => ({ tipo: 'descripcion_duplicada', ...d })),
    ...mismoCodDistintasHoras.map((d) => ({ tipo: 'mismo_codigo_horas_distintas', ...d })),
  ]

  // ── Guardar archivos ──────────────────────────────────────────────────────
  console.log('\n  Guardando archivos...')

  saveJson('services-normalized.json', services)
  saveJson('packages-normalized.json', packages)
  saveJson('package-items-normalized.json',
    packages.flatMap((p) => p.items.map((i) => ({ paqueteCodigo: p.codigo, paqueteNombre: p.nombre, ...i })))
  )
  saveJson('services-dedupe-candidates.json', dedupeCandidates)
  saveJson('labor-calculation-examples.json', calcExamples)
  saveJson('repair-orders-sample.json', {
    totalAnalizadas: totalOTs,
    otsRaw: otsMetadata,
    totalLaborLines: allLaborLines.length,
    totalPackageHeaders: allPackageHeaders.length,
  })

  // ── Informe de calidad ────────────────────────────────────────────────────
  const verifiedCalc = calcExamples.filter((e) => e.calculoVerificado).length
  const conCodigo = services.filter((s) => s.codigo !== null).length
  const conHoras = services.filter((s) => s.horasEstandar !== null).length
  const conPrecio = services.filter((s) => s.precioNeto !== null && s.precioNeto > 0).length
  const enPaquete = services.filter((s) => s.esParte_dePaquete).length

  const topVH = valorHoraRanking[0]

  const md = `# Informe de Auditoría — Catálogo de Servicios TallerGP

Generado: ${new Date().toISOString().replace('T', ' ').slice(0, 19)}
Basado en: ${totalOTs} OT(s) analizadas + ${checkpointOtIds.size > 0 ? checkpointOtIds.size + ' de checkpoint' : '0 de checkpoint'}

---

## Endpoints disponibles (FASE 1)

Ver \`endpoints-discovery.json\` para el listado completo.

| Endpoint | Estado |
|---|---|
| /labor, /labors, /services, /service-items | ✗ HTTP 404 — No existen |
| /packages, /service-packages, /package | ✗ HTTP 404 — No existen |
| /materials | ✓ HTTP 200 — 2.989 items |
| /repair-orders | ✓ HTTP 200 — 5.449 OTs |
| /budgets | ✓ HTTP 200 — 3.055 presupuestos |
| /employees | ✓ HTTP 200 — 9 empleados |
| /suppliers | ✓ HTTP 200 — 133 proveedores |
| /brands | ✓ HTTP 200 — 1.419 marcas |
| /invoices | ✓ HTTP 200 — 4.687 facturas |
| /vehicles | ✓ HTTP 200 — 3.540 vehículos |

**Conclusión FASE 1:** TallerGP NO expone endpoints directos para labor, servicios o paquetes.
La única forma de recuperarlos es reconstrucción desde OTs históricas.

---

## FASE 4 — Fórmula de mano de obra

### Fórmula confirmada

\`\`\`
total_linea = quantity × unit_price_net × (1 − discount_percentage / 100)
\`\`\`

**Verificación:** ${verifiedCalc}/${calcExamples.length} líneas verificadas (${calcExamples.length > 0 ? Math.round(verifiedCalc / calcExamples.length * 100) : 0}%)

### Ejemplos reales

| OT | Servicio | Horas | $/hr | Dto% | Total | ✓ |
|---|---|---|---|---|---|---|
${calcExamples.slice(0, 15).map((e) =>
  `| ${e.otNumber} | ${e.description.slice(0, 40)} | ${e.horas} | $${e.valorHora.toLocaleString('es-CL')} | ${e.descuentoPct}% | $${e.totalReal.toLocaleString('es-CL')} | ${e.calculoVerificado ? '✓' : '✗'} |`
).join('\n')}

### Valores hora encontrados

| Valor/hora (CLP) | Usos | Empleados | Servicios ejemplo |
|---|---|---|---|
${valorHoraRanking.slice(0, 10).map((v) =>
  `| **$${v.valorHora.toLocaleString('es-CL')}** | ${v.count} | ${v.empleados.join(', ')} | ${v.servicios.join(', ')} |`
).join('\n')}

${valorHoraRanking.length === 1
  ? `\n**El valor hora es ÚNICO: $${valorHoraRanking[0].valorHora.toLocaleString('es-CL')}/hr** para todos los trabajos analizados.`
  : `\n**Hay ${valorHoraRanking.length} valores hora distintos** — revisar si hay diferenciación por tipo de trabajo.`}

---

## FASE 5 — Catálogo de servicios

### Resumen de calidad

| Métrica | Valor |
|---|---|
| OTs analizadas | **${totalOTs}** |
| Total labor lines | **${allLaborLines.length}** |
| Servicios únicos | **${services.length}** |
| Con código | ${conCodigo} (${Math.round(conCodigo / Math.max(services.length, 1) * 100)}%) |
| Sin código | ${services.length - conCodigo} |
| Con horas estándar | ${conHoras} |
| Sin horas | ${services.length - conHoras} |
| Con precio | ${conPrecio} |
| En paquetes | ${enPaquete} |
| Usados >1 vez | ${services.filter((s) => s.usoCount > 1).length} |
| Usados solo 1 vez | ${services.filter((s) => s.usoCount === 1).length} |
| Códigos duplicados | ${codigosDup.length} |
| Descripciones dup. | ${descripcionesDup.length} |
| Horas variables | ${mismoCodDistintasHoras.length} |

### Catálogo completo (top ${Math.min(services.length, 60)})

| # | Código | Nombre | Horas std | $/hr | Usos | En pkg |
|---|---|---|---|---|---|---|
${services.slice(0, 60).map((s, i) =>
  `| ${i + 1} | \`${s.codigo ?? '—'}\` | ${s.nombre.slice(0, 50)} | ${s.horasEstandar ?? '—'} | ${s.valorHora ? '$' + s.valorHora.toLocaleString('es-CL') : '—'} | ${s.usoCount} | ${s.esParte_dePaquete ? s.paqueteCodigos.join(',') : '—'} |`
).join('\n')}

${codigosDup.length > 0 ? `
### Códigos duplicados

${codigosDup.map((d) => `- **${d.codigo}** → ${d.variantes} variantes: ${d.nombres.map((n) => `"${n}"`).join(', ')}`).join('\n')}
` : ''}

${mismoCodDistintasHoras.length > 0 ? `
### Mismo código — horas variables

${mismoCodDistintasHoras.map((d) => `- **${d.codigo}** → horas: [${d.horas.join(', ')}] (${d.usosTotales} usos totales)`).join('\n')}
` : ''}

---

## Paquetes detectados

| # | Código | Nombre | Items labor | Items mat | Horas | M.O. | Usos |
|---|---|---|---|---|---|---|---|
${packages.slice(0, 20).map((p, i) => {
  const laborCount = p.items.filter((i) => i.tipo === 'labor').length
  const matCount = p.items.filter((i) => i.tipo === 'material').length
  return `| ${i + 1} | ${p.codigo} | ${p.nombre.slice(0, 40)} | ${laborCount} | ${matCount} | ${p.totalHorasEstimado.toFixed(1)} | $${p.totalManoObraEstimado.toLocaleString('es-CL')} | ${p.usoCount} |`
}).join('\n')}

${packages.filter((p) => p.items.length > 0).slice(0, 3).map((p) => `
### Detalle: ${p.codigo} — "${p.nombre}"

Usos: ${p.usoCount} | Horas: ${p.totalHorasEstimado.toFixed(1)} | M.O.: $${p.totalManoObraEstimado.toLocaleString('es-CL')}

| Tipo | Código | Nombre | Qty/Hrs | Precio | LineType |
|---|---|---|---|---|---|
${p.items.map((i) =>
  `| ${i.tipo} | ${i.codigo ?? '—'} | ${i.nombre.slice(0, 45)} | ${i.tipo === 'labor' ? i.horas + 'h' : i.cantidad} | $${i.precioNeto.toLocaleString('es-CL')} | ${i.packageLineType ?? '—'} |`
).join('\n')}
`).join('\n')}

---

## Conclusión: ¿Se pueden recuperar las manos de obra y paquetes?

**RESPUESTA: ${services.length >= 20 ? 'B' : services.length >= 5 ? 'C' : 'B (muestra parcial)'} — ${
  services.length >= 20
    ? 'Sí, reconstruyendo desde órdenes históricas.'
    : 'Parcialmente, con datos de muestra limitada. Ejecutar con más OTs.'
}**

Con ${totalOTs} OT(s) analizadas:
- **${services.length} servicios únicos** recuperados
- **${packages.length} paquetes** reconstruidos
- Fórmula de cálculo: **verificada en ${calcExamples.length > 0 ? Math.round(verifiedCalc / calcExamples.length * 100) : 0}%** de las líneas
- Valor hora predominante: ${topVH ? `**$${topVH.valorHora.toLocaleString('es-CL')}/hr** (${topVH.count} usos)` : 'No determinado'}

**Limitación:** Los 5.449 OTs del sistema contienen mucho más catálogo. Con ${totalOTs} OTs solo se cubre una fracción del catálogo real. Ejecutar el script completo (audit-services.ts) cuando el rate limit de la API expire para obtener ~300 OTs.

---

## Modelo recomendado (diseño, no implementar aún)

### catalogo_servicios
- id, org_id, codigo (UNIQUE por org), nombre, descripcion, categoria
- horas_estandar (NUMERIC 6,2), valor_hora_default (INTEGER)
- activo, fuente, external_id, timestamps

### plantillas_trabajo (paquetes)
- id, org_id, codigo, nombre, descripcion, categoria
- activo, fuente, external_id, timestamps

### items_plantilla
- plantilla_id, tipo (labor|material|service), servicio_id?, repuesto_id?
- codigo_externo, nombre, cantidad, horas, orden

### trabajo_ot
- orden_trabajo_id, servicio_id?, descripcion, referencia, mecanico_id
- horas_estimadas, horas_reales, valor_hora, descuento_pct
- precio_mano_obra (GENERATED: horas × valor_hora × (1 - dto))
- estado, inicio, termino

### configuracion_mano_obra
- org_id, valor_hora_mecanica, valor_hora_diagnostico, iva_porcentaje

---

## Próximo paso recomendado

1. Esperar que el rate limit expire (~1 hora) y re-ejecutar \`audit-services.ts\`
2. Re-ejecutar con: \`npx tsx src/scripts/audit-services.ts --skip-discovery --max-ots 300\`
3. El script cargará el checkpoint y continuará desde donde quedó
4. Con ~300 OTs tendremos un catálogo representativo
5. Sprint 10: Migration 005 — catalogo_servicios + trabajo_ot
`

  saveMarkdown('services-quality-report.md', md)

  // Resumen final
  console.log('\n╔══════════════════════════════════════════════════╗')
  console.log('║  RESUMEN FINAL                                   ║')
  console.log('╚══════════════════════════════════════════════════╝')
  console.log(`  OTs analizadas:          ${totalOTs}`)
  console.log(`  Labor lines totales:     ${allLaborLines.length}`)
  console.log(`  Servicios únicos:        ${services.length}`)
  console.log(`  Paquetes únicos:         ${packages.length}`)
  console.log(`  Con código:              ${conCodigo}/${services.length}`)
  console.log(`  Con horas estándar:      ${conHoras}/${services.length}`)
  if (topVH) console.log(`  Valor hora dominante:    $${topVH.valorHora.toLocaleString('es-CL')}/hr (${topVH.count} usos)`)
  console.log(`  Fórmula verificada:      ${calcExamples.length > 0 ? Math.round(verifiedCalc / calcExamples.length * 100) + '%' : 'N/A'}`)

  const answer = services.length >= 20
    ? 'B — Sí, reconstruyendo desde órdenes históricas'
    : 'C — Parcialmente (muestra limitada, ejecutar con más OTs)'

  console.log(`\n  ¿Se pueden recuperar? ${answer}`)
  console.log('\n✅ Análisis completado.\n')
}

main()

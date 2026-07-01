/**
 * Customer Report — TallerGP
 * Extrae un cliente por RUT, sus vehículos y el historial de mantención
 * (órdenes de reparación) por vehículo. Solo lectura — no modifica datos.
 *
 * Uso:
 *   npm run customer-report -- --rut 77406890-2
 *   npm run customer-report -- --rut 77406890-2 --details   # incluye líneas de cada OT
 */

import 'dotenv/config'
import { mkdirSync, writeFileSync } from 'fs'
import { resolve } from 'path'
import { logger } from '../utils/logger.js'
import { getBearerToken } from '../api/tallergp/auth.js'
import { getClient, type PaginatedResponse } from '../api/tallergp/client.js'
import {
  getCustomer,
  type TallerGPCustomer,
} from '../api/tallergp/endpoints/customers.js'
import { type TallerGPVehicle } from '../api/tallergp/endpoints/vehicles.js'
import {
  getRepairOrder,
  type TallerGPRepairOrder,
} from '../api/tallergp/endpoints/repair-orders.js'

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const rutArg = args[args.indexOf('--rut') + 1] ?? '77406890-2'
const withDetails = args.includes('--details')
const RUT = normalizeRut(rutArg)

const REPORTS_DIR = resolve(process.cwd(), 'reports')
const DELAY_MS = 400

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** Normaliza un RUT: quita puntos, guiones y espacios; a mayúsculas (por la K). */
function normalizeRut(rut: string): string {
  return rut.replace(/[.\-\s]/g, '').toUpperCase()
}

// ── Pagination helper ─────────────────────────────────────────────────────────

async function fetchAllPages<T>(
  endpoint: string,
  params: Record<string, unknown> = {},
  label = '',
): Promise<T[]> {
  const client = getClient()
  const perPage = 50
  const all: T[] = []
  let page = 1
  let totalPages = 1

  do {
    const res = await client.get<PaginatedResponse<T>>(endpoint, {
      params: { ...params, page, per_page: perPage },
    })
    const body = res.data
    totalPages = Number(body.pagination?.total_pages ?? 1)
    all.push(...(body.data ?? []))
    if (label && totalPages > 1) logger.info(`  ${label}: página ${page}/${totalPages}`)
    page++
    if (page <= totalPages) await sleep(DELAY_MS)
  } while (page <= totalPages)

  return all
}

/** Extrae el RUT (vat_number) de un cliente en forma normalizada. */
function customerRut(c: TallerGPCustomer): string {
  return normalizeRut(String(c.vat_number ?? ''))
}

// ── Búsqueda de cliente por RUT ────────────────────────────────────────────────

async function findCustomerByRut(rut: string): Promise<TallerGPCustomer | null> {
  // Recorre /customers página por página y corta apenas encuentra el RUT.
  logger.info(`Buscando cliente con RUT ${rutArg} (normalizado: ${rut})...`)
  const client = getClient()
  const perPage = 50
  let page = 1
  let totalPages = 1
  let revisados = 0

  do {
    const res = await client.get<PaginatedResponse<TallerGPCustomer>>('/customers', {
      params: { page, per_page: perPage },
    })
    const body = res.data
    totalPages = Number(body.pagination?.total_pages ?? 1)
    const rows = body.data ?? []
    revisados += rows.length

    const match = rows.find((c) => customerRut(c) === rut)
    if (match) {
      logger.info(`  encontrado en página ${page}/${totalPages} (${revisados} clientes revisados)`)
      return match
    }

    page++
    if (page <= totalPages) await sleep(DELAY_MS)
  } while (page <= totalPages)

  logger.info(`  ${revisados} clientes revisados, sin coincidencia`)
  return null
}

// ── Tipos del reporte ──────────────────────────────────────────────────────────

interface VehicleWithHistory {
  vehicle: TallerGPVehicle
  repairOrders: TallerGPRepairOrder[]
  repairOrderDetails: TallerGPRepairOrder[]
}

interface CustomerReport {
  rut: string
  customer: TallerGPCustomer | null
  vehicles: VehicleWithHistory[]
  errors: string[]
  fetchedAt: string
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Customer Report — RUT: ${rutArg}`)
  console.log(`  Solo lectura · TallerGP API${withDetails ? ' · con detalle de OTs' : ''}`)
  console.log(`${'═'.repeat(60)}\n`)

  await getBearerToken()
  logger.info('Auth OK')

  const report: CustomerReport = {
    rut: rutArg,
    customer: null,
    vehicles: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
  }

  // 1. Buscar cliente por RUT
  const match = await findCustomerByRut(RUT)
  if (!match) {
    logger.error(`Cliente con RUT ${rutArg} no encontrado.`)
    report.errors.push(`Cliente con RUT ${rutArg} no encontrado`)
    persist(report)
    return
  }
  const clientId = String(match.id)
  logger.info(`Cliente encontrado — ID ${clientId}: ${match.name}${match.lastname ? ' ' + match.lastname : ''}`)

  // 2. Detalle del cliente
  try {
    report.customer = await getCustomer(clientId)
  } catch (err) {
    report.customer = match
    report.errors.push(`Error detalle cliente: ${(err as Error).message}`)
  }

  // 3. Vehículos del cliente (paginado — el endpoint devuelve 10 por defecto)
  logger.info('Obteniendo vehículos del cliente...')
  let vehicles: TallerGPVehicle[] = []
  try {
    vehicles = await fetchAllPages<TallerGPVehicle>(
      `/customers/${clientId}/vehicles`,
      {},
      'Vehículos',
    )
    logger.info(`  ${vehicles.length} vehículo(s)`)
  } catch (err) {
    report.errors.push(`Error obteniendo vehículos: ${(err as Error).message}`)
  }

  // 4. Historial de mantención (OTs) por vehículo
  for (const [i, v] of vehicles.entries()) {
    const vehicleId = String(v.id)
    logger.info(`[${i + 1}/${vehicles.length}] Vehículo ${v.plate ?? vehicleId} — historial...`)
    const entry: VehicleWithHistory = { vehicle: v, repairOrders: [], repairOrderDetails: [] }
    try {
      entry.repairOrders = await fetchAllPages<TallerGPRepairOrder>(
        '/repair-orders',
        { vehicle_id: vehicleId },
        'OTs',
      )
      logger.info(`  ${entry.repairOrders.length} OT(s)`)
    } catch (err) {
      report.errors.push(`Error OTs de ${v.plate ?? vehicleId}: ${(err as Error).message}`)
    }

    if (withDetails && entry.repairOrders.length > 0) {
      for (const ot of entry.repairOrders) {
        try {
          entry.repairOrderDetails.push(await getRepairOrder(String(ot.entry_id)))
        } catch (err) {
          report.errors.push(`Error detalle OT ${ot.order_number}: ${(err as Error).message}`)
        }
        await sleep(DELAY_MS)
      }
    }

    report.vehicles.push(entry)
    await sleep(DELAY_MS)
  }

  persist(report)
}

// ── Persistencia (JSON + Markdown) ──────────────────────────────────────────────

function persist(report: CustomerReport): void {
  mkdirSync(REPORTS_DIR, { recursive: true })
  const slug = report.rut.replace(/[.\-\s]/g, '')
  const jsonPath = resolve(REPORTS_DIR, `cliente-${slug}.json`)
  const mdPath = resolve(REPORTS_DIR, `cliente-${slug}.md`)

  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf8')
  writeFileSync(mdPath, renderMarkdown(report), 'utf8')

  const totalOts = report.vehicles.reduce((n, v) => n + v.repairOrders.length, 0)
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  Reporte: ${mdPath.replace(process.cwd() + '/', '')}`)
  console.log(`  JSON   : ${jsonPath.replace(process.cwd() + '/', '')}`)
  console.log(`  Vehículos: ${report.vehicles.length}  ·  OTs totales: ${totalOts}`)
  if (report.errors.length > 0) console.log(`  Errores  : ${report.errors.length}`)
  console.log(`${'═'.repeat(60)}\n`)
}

function fmtDate(s: string | null | undefined): string {
  if (!s) return '—'
  const d = new Date(s)
  return isNaN(d.getTime()) ? String(s) : d.toLocaleDateString('es-CL')
}

function fmtCLP(n: number | null | undefined): string {
  if (n == null) return '—'
  return n.toLocaleString('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 })
}

function renderMarkdown(r: CustomerReport): string {
  const c = r.customer
  const lines: string[] = []
  lines.push(`# Cliente TallerGP — ${c?.name ?? '(desconocido)'}${c?.lastname ? ' ' + c.lastname : ''}`)
  lines.push('')
  lines.push(`_Generado ${new Date(r.fetchedAt).toLocaleString('es-CL')} · Solo lectura_`)
  lines.push('')

  if (!c) {
    lines.push(`> ⚠ No se encontró el cliente con RUT ${r.rut}.`)
    if (r.errors.length) lines.push('', '## Errores', ...r.errors.map((e) => `- ${e}`))
    return lines.join('\n')
  }

  lines.push('## Datos de contacto')
  lines.push('')
  lines.push(`| Campo | Valor |`)
  lines.push(`|---|---|`)
  lines.push(`| RUT | ${c.vat_number ?? '—'} |`)
  lines.push(`| Nombre | ${c.name ?? '—'}${c.lastname ? ' ' + c.lastname : ''} |`)
  lines.push(`| Teléfono | ${c.phone ?? '—'} |`)
  lines.push(`| Móvil | ${c.mobile ?? '—'} |`)
  lines.push(`| Email | ${c.mail ?? '—'} |`)
  lines.push(`| Dirección | ${[c.address, c.location, c.province].filter(Boolean).join(', ') || '—'} |`)
  lines.push(`| Nº cliente | ${c.customer_number ?? '—'} |`)
  lines.push('')

  lines.push(`## Vehículos (${r.vehicles.length})`)
  lines.push('')

  if (r.vehicles.length === 0) {
    lines.push('_El cliente no tiene vehículos asociados en TallerGP._')
  }

  for (const vh of r.vehicles) {
    const v = vh.vehicle
    const title = [v.plate, v.model].filter(Boolean).join(' — ') || `Vehículo ${v.id}`
    lines.push(`### 🚗 ${title}`)
    lines.push('')
    lines.push(
      `- **VIN**: ${v.vin ?? '—'}  ·  **Año**: ${v.model_year ?? '—'}  ·  **Color**: ${v.color ?? '—'}  ·  **Km**: ${v.kms?.toLocaleString('es-CL') ?? '—'}`,
    )
    lines.push('')
    lines.push(`**Historial de mantención — ${vh.repairOrders.length} orden(es)**`)
    lines.push('')

    if (vh.repairOrders.length === 0) {
      lines.push('_Sin órdenes de reparación registradas._')
      lines.push('')
      continue
    }

    const ordered = [...vh.repairOrders].sort(
      (a, b) => new Date(b.entry_date ?? 0).getTime() - new Date(a.entry_date ?? 0).getTime(),
    )
    lines.push(`| Nº OT | Fecha | Estado | Total neto |`)
    lines.push(`|---|---|---|---|`)
    for (const ot of ordered) {
      const estado = ot.service_status_name ?? (isClosed(ot) ? 'Cerrada' : 'Abierta')
      const total = ot.total_amount_net_from_entry ?? null
      lines.push(`| ${ot.order_number} | ${fmtDate(ot.entry_date)} | ${estado} | ${fmtCLP(total)} |`)
    }
    lines.push('')

    // Detalle de líneas por OT (si se pidió --details)
    const detailsById = new Map(vh.repairOrderDetails.map((d) => [String(d.entry_id), d]))
    if (detailsById.size > 0) {
      for (const ot of ordered) {
        const d = detailsById.get(String(ot.entry_id))
        if (!d) continue
        const allLines = [
          ...(d.labor ?? []).map((l) => ({ ...l, _k: 'Mano de obra' })),
          ...(d.parts ?? []).map((l) => ({ ...l, _k: 'Repuesto' })),
          ...(d.other ?? []).map((l) => ({ ...l, _k: 'Otro' })),
        ]
        if (allLines.length === 0) continue
        lines.push(`<details><summary>Detalle OT ${d.order_number}</summary>`)
        lines.push('')
        lines.push(`| Tipo | Descripción | Cant. | P. unit. | Total |`)
        lines.push(`|---|---|---|---|---|`)
        for (const l of allLines) {
          lines.push(
            `| ${l._k} | ${l.description ?? l.reference ?? '—'} | ${l.quantity ?? '—'} | ${fmtCLP(l.unit_price)} | ${fmtCLP(l.total)} |`,
          )
        }
        lines.push('')
        lines.push('</details>')
        lines.push('')
      }
    }
  }

  if (r.errors.length) {
    lines.push('## Errores')
    lines.push('')
    lines.push(...r.errors.map((e) => `- ${e}`))
  }

  return lines.join('\n')
}

function isClosed(ot: TallerGPRepairOrder): boolean {
  const v = ot.is_closed
  return v === true || v === 1 || v === '1' || v === 'true'
}

main().catch((err) => {
  logger.error('Error fatal', { error: (err as Error).message })
  process.exit(1)
})

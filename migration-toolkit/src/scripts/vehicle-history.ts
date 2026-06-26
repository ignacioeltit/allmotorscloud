/**
 * Vehicle History Validator
 * Extrae el historial completo de un vehículo desde la API de TallerGP.
 * Solo lectura — no modifica datos.
 *
 * Uso:
 *   npm run vehicle-history                    # patente por defecto SRDV88
 *   npm run vehicle-history -- --plate SRDV88  # patente específica
 */

import 'dotenv/config'
import { mkdirSync } from 'fs'
import { resolve } from 'path'
import { logger } from '../utils/logger.js'
import { getBearerToken } from '../api/tallergp/auth.js'
import { getClient, type PaginatedResponse } from '../api/tallergp/client.js'
import { getCustomer } from '../api/tallergp/endpoints/customers.js'
import { getVehicle, listVehicles, type TallerGPVehicle } from '../api/tallergp/endpoints/vehicles.js'
import { listRepairOrders, getRepairOrder, type TallerGPRepairOrder } from '../api/tallergp/endpoints/repair-orders.js'
import { listBudgets, type TallerGPBudget } from '../api/tallergp/endpoints/budgets.js'
import { listInvoices, getInvoice, type TallerGPInvoice } from '../api/tallergp/endpoints/invoices.js'
import { generateVehicleReport } from './vehicle-history-report.js'

// ── CLI ───────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const plateArg = args[args.indexOf('--plate') + 1] ?? 'SRDV88'
const plate = plateArg.toUpperCase().replace(/\s/g, '')

const REPORTS_DIR = resolve(process.cwd(), 'reports')
const DELAY_MS = 400

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

// ── Pagination helper ─────────────────────────────────────────────────────────

async function fetchAllPages<T>(
  endpoint: string,
  params: Record<string, unknown> = {},
  label = ''
): Promise<T[]> {
  const client = getClient()
  const perPage = 50
  const allRecords: T[] = []
  let page = 1
  let totalPages = 1

  do {
    const res = await client.get<PaginatedResponse<T>>(endpoint, {
      params: { ...params, page, per_page: perPage },
    })
    const body = res.data
    totalPages = Number(body.pagination?.total_pages ?? 1)
    allRecords.push(...(body.data ?? []))

    if (label && totalPages > 1) {
      logger.info(`  ${label}: página ${page}/${totalPages}`)
    }

    page++
    if (page <= totalPages) await sleep(DELAY_MS)
  } while (page <= totalPages)

  return allRecords
}

// ── Data fetching ─────────────────────────────────────────────────────────────

export interface VehicleHistory {
  plate: string
  vehicle: TallerGPVehicle | null
  vehicleDetail: TallerGPVehicle | null
  customer: Record<string, unknown> | null
  repairOrders: TallerGPRepairOrder[]
  repairOrderDetails: TallerGPRepairOrder[]
  budgets: TallerGPBudget[]
  invoices: TallerGPInvoice[]
  invoiceDetails: TallerGPInvoice[]
  pdfs: PdfRef[]
  errors: string[]
  fetchedAt: string
}

export interface PdfRef {
  source: string
  orderId?: string
  orderNumber?: string
  invoiceId?: string
  invoiceNumber?: string
  url: string
}

async function main(): Promise<void> {
  console.log(`\n${'═'.repeat(55)}`)
  console.log(`  Vehicle History Validator — Patente: ${plate}`)
  console.log(`  Solo lectura · TallerGP API`)
  console.log(`${'═'.repeat(55)}\n`)

  await getBearerToken()
  logger.info('Auth OK')

  const history: VehicleHistory = {
    plate,
    vehicle: null,
    vehicleDetail: null,
    customer: null,
    repairOrders: [],
    repairOrderDetails: [],
    budgets: [],
    invoices: [],
    invoiceDetails: [],
    pdfs: [],
    errors: [],
    fetchedAt: new Date().toISOString(),
  }

  // 1. Buscar vehículo por patente
  logger.info(`Buscando vehículo con patente ${plate}...`)
  try {
    const searchRes = await listVehicles({ plate, per_page: 5 })
    const match = searchRes.data.find(
      (v) => (v.plate ?? '').toUpperCase().replace(/\s|-/g, '') === plate.replace(/-/g, '')
    )
    if (!match) {
      logger.error(`Vehículo ${plate} no encontrado en la API`)
      history.errors.push(`Vehículo ${plate} no encontrado`)
      await generateVehicleReport(history, REPORTS_DIR)
      return
    }
    history.vehicle = match
    logger.info(`Vehículo encontrado — ID: ${match.id}`)
  } catch (err) {
    history.errors.push(`Error buscando vehículo: ${(err as Error).message}`)
  }

  if (!history.vehicle?.id) {
    await generateVehicleReport(history, REPORTS_DIR)
    return
  }

  const vehicleId = history.vehicle.id as string

  // 2. Detalle del vehículo
  logger.info('Obteniendo detalle del vehículo...')
  try {
    history.vehicleDetail = await getVehicle(vehicleId)
  } catch (err) {
    history.errors.push(`Error detalle vehículo: ${(err as Error).message}`)
  }

  // 3. Cliente
  const clientId = (history.vehicleDetail?.client_id ?? history.vehicle.client_id) as string | undefined
  if (clientId) {
    logger.info('Obteniendo datos del cliente...')
    try {
      history.customer = await getCustomer(clientId) as Record<string, unknown>
    } catch (err) {
      history.errors.push(`Error obteniendo cliente: ${(err as Error).message}`)
    }
  }

  // 4. Todas las órdenes de trabajo
  logger.info('Obteniendo todas las órdenes de trabajo...')
  try {
    history.repairOrders = await fetchAllPages<TallerGPRepairOrder>(
      '/repair-orders',
      { vehicle_id: vehicleId },
      'OTs'
    )
    logger.info(`  ${history.repairOrders.length} OTs encontradas`)
  } catch (err) {
    history.errors.push(`Error listando OTs: ${(err as Error).message}`)
  }

  // 5. Detalle de cada OT
  if (history.repairOrders.length > 0) {
    logger.info(`Obteniendo detalle de ${history.repairOrders.length} OT(s)...`)
    for (const [i, ot] of history.repairOrders.entries()) {
      const entryId = ot.entry_id as string
      try {
        const detail = await getRepairOrder(entryId)
        history.repairOrderDetails.push(detail)

        // Recopilar PDFs
        const pdfUrl = (detail.pdf ?? ot.pdf) as string | undefined
        if (pdfUrl && pdfUrl.startsWith('http')) {
          history.pdfs.push({
            source: 'repair-order',
            orderId: entryId,
            orderNumber: detail.order_number as string,
            url: pdfUrl,
          })
        }

        logger.info(`  [${i + 1}/${history.repairOrders.length}] ${ot.order_number} — OK`)
      } catch (err) {
        history.errors.push(`Error detalle OT ${ot.order_number}: ${(err as Error).message}`)
        logger.warn(`  [${i + 1}] Error en ${ot.order_number}: ${(err as Error).message}`)
      }
      await sleep(DELAY_MS)
    }
  }

  // 6. Presupuestos
  logger.info('Obteniendo presupuestos...')
  try {
    history.budgets = await fetchAllPages<TallerGPBudget>(
      '/budgets',
      { vehicle_id: vehicleId },
      'Presupuestos'
    )
    logger.info(`  ${history.budgets.length} presupuesto(s)`)
  } catch (err) {
    history.errors.push(`Error obteniendo presupuestos: ${(err as Error).message}`)
  }

  // 7. Facturas
  logger.info('Obteniendo facturas...')
  try {
    history.invoices = await fetchAllPages<TallerGPInvoice>(
      '/invoices',
      { vehicle_id: vehicleId },
      'Facturas'
    )
    logger.info(`  ${history.invoices.length} factura(s)`)

    // Detalle de cada factura (para líneas y PDF)
    for (const inv of history.invoices) {
      const invId = inv.invoice_id as string
      try {
        const detail = await getInvoice(invId)
        history.invoiceDetails.push(detail)

        const pdfUrl = detail.pdf as string | undefined
        if (pdfUrl && pdfUrl.startsWith('http')) {
          history.pdfs.push({
            source: 'invoice',
            invoiceId: invId,
            invoiceNumber: detail.invoice_number as string,
            url: pdfUrl,
          })
        }
        await sleep(DELAY_MS)
      } catch (err) {
        history.errors.push(`Error detalle factura ${inv.invoice_number}: ${(err as Error).message}`)
      }
    }
  } catch (err) {
    history.errors.push(`Error listando facturas: ${(err as Error).message}`)
  }

  // 8. Generar reporte
  logger.info('Generando reporte...')
  mkdirSync(REPORTS_DIR, { recursive: true })
  const reportPath = await generateVehicleReport(history, REPORTS_DIR)

  console.log(`\n${'═'.repeat(55)}`)
  console.log(`  Reporte generado: ${reportPath.replace(process.cwd() + '/', '')}`)
  console.log(`  OTs procesadas : ${history.repairOrderDetails.length}/${history.repairOrders.length}`)
  console.log(`  Presupuestos   : ${history.budgets.length}`)
  console.log(`  Facturas       : ${history.invoiceDetails.length}`)
  console.log(`  PDFs           : ${history.pdfs.length}`)
  if (history.errors.length > 0) {
    console.log(`  Errores        : ${history.errors.length}`)
  }
  console.log(`${'═'.repeat(55)}\n`)
}

main().catch((err) => {
  logger.error('Error fatal', { error: err.message })
  process.exit(1)
})

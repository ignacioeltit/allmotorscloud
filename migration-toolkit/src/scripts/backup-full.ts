/**
 * Respaldo completo (solo lectura) de clientes, vehículos y OTs desde TallerGP.
 *
 * Guarda todo como JSON crudo en ./exports/backup/{customers,vehicles,repair-orders}/.
 * Es resumible: si se corta a mitad de camino, basta con volver a ejecutar
 * `npm run backup-full` — los archivos ya escritos en disco actúan como checkpoint
 * (no se vuelve a pedir un detalle ya guardado).
 *
 * Ejecutar: npm run backup-full
 */

import 'dotenv/config'
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs'
import { resolve, join } from 'path'
import pLimit from 'p-limit'
import { logger } from '../utils/logger.js'
import { listCustomers } from '../api/tallergp/endpoints/customers.js'
import { listVehicles, getVehicle } from '../api/tallergp/endpoints/vehicles.js'
import { listRepairOrders, getRepairOrder } from '../api/tallergp/endpoints/repair-orders.js'

const BACKUP_DIR = resolve(process.env.EXPORT_DIR ?? './exports', 'backup')
const PER_PAGE = 100
const CONCURRENCY = Number(process.env.RATE_LIMIT_RPS ?? 3)
const PAGE_DELAY_MS = 300
// Solo para pruebas: limita cuántos detalles se piden por corrida (no afecta el listado).
const DETAIL_LIMIT = process.env.BACKUP_DETAIL_LIMIT ? Number(process.env.BACKUP_DETAIL_LIMIT) : Infinity

function ensureDir(dir: string): void {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true })
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

function pad(n: number): string {
  return String(n).padStart(5, '0')
}

// ── Clientes ──────────────────────────────────────────────────────────────
// El listado ya trae todos los campos del cliente (confirmado contra muestra real),
// no hace falta detalle por ID. Se respalda página por página.
async function backupCustomers(): Promise<void> {
  const dir = join(BACKUP_DIR, 'customers')
  ensureDir(dir)

  logger.info('── Clientes ──')
  let page = 1
  let totalPages = 1
  let totalCount = 0

  do {
    const pageFile = join(dir, `page-${pad(page)}.json`)
    if (existsSync(pageFile)) {
      // Ya respaldada en una corrida anterior. Solo necesitamos leer totalPages
      // de la última página conocida si aún no la tenemos.
      page++
      continue
    }
    const res = await listCustomers({ page, per_page: PER_PAGE })
    totalPages = res.pagination.total_pages
    totalCount = res.pagination.total_count
    writeFileSync(pageFile, JSON.stringify(res, null, 2), 'utf-8')
    logger.info(`Clientes: página ${page}/${totalPages} guardada (${res.data.length} registros)`)
    page++
    if (page <= totalPages) await sleep(PAGE_DELAY_MS)
  } while (page <= totalPages)

  logger.info(`✅ Clientes respaldados: ${totalCount} en total, ${totalPages} páginas`)
}

// ── Vehículos ─────────────────────────────────────────────────────────────
// El listado no trae todos los campos (falta año, combustible, cilindrada, etc.)
// así que además del listado se pide el detalle por ID.
async function backupVehicles(): Promise<void> {
  const listDir = join(BACKUP_DIR, 'vehicles-list')
  const detailDir = join(BACKUP_DIR, 'vehicles')
  ensureDir(listDir)
  ensureDir(detailDir)

  logger.info('── Vehículos: listado ──')
  const allIds: string[] = []
  let page = 1
  let totalPages = 1

  do {
    const listFile = join(listDir, `page-${pad(page)}.json`)
    if (existsSync(listFile)) {
      const cached = JSON.parse(readFileSync(listFile, 'utf-8'))
      totalPages = cached.pagination.total_pages
      for (const v of cached.data as { id: string }[]) allIds.push(v.id)
      page++
      continue
    }
    const res = await listVehicles({ page, per_page: PER_PAGE })
    totalPages = res.pagination.total_pages
    writeFileSync(listFile, JSON.stringify(res, null, 2), 'utf-8')
    for (const v of res.data) allIds.push(v.id)
    logger.info(`Vehículos (listado): página ${page}/${totalPages} guardada (${res.data.length} registros)`)
    page++
    if (page <= totalPages) await sleep(PAGE_DELAY_MS)
  } while (page <= totalPages)

  logger.info(`Listado de vehículos completo: ${allIds.length} IDs recolectados`)

  logger.info('── Vehículos: detalle por ID ──')
  const pending = allIds.filter((id) => !existsSync(join(detailDir, `${id}.json`))).slice(0, DETAIL_LIMIT)
  logger.info(`Pendientes de detalle: ${pending.length} de ${allIds.length} (ya respaldados: ${allIds.length - pending.length})`)

  const limit = pLimit(CONCURRENCY)
  let done = 0
  await Promise.all(
    pending.map((id) =>
      limit(async () => {
        try {
          const detail = await getVehicle(id)
          writeFileSync(join(detailDir, `${id}.json`), JSON.stringify(detail, null, 2), 'utf-8')
        } catch (err) {
          logger.error(`Error detalle vehículo ${id}`, { error: (err as Error).message })
        } finally {
          done++
          if (done % 100 === 0 || done === pending.length) {
            logger.info(`Vehículos (detalle): ${done}/${pending.length} procesados`)
          }
        }
      })
    )
  )

  logger.info(`✅ Vehículos respaldados: ${allIds.length} en total`)
}

// ── Órdenes de trabajo (historial de mantenciones) ───────────────────────
// El listado solo trae resumen. El detalle por entry_id trae parts/labor/paint/other.
async function backupRepairOrders(): Promise<void> {
  const listDir = join(BACKUP_DIR, 'repair-orders-list')
  const detailDir = join(BACKUP_DIR, 'repair-orders')
  ensureDir(listDir)
  ensureDir(detailDir)

  logger.info('── Órdenes de trabajo: listado ──')
  const allIds: string[] = []
  let page = 1
  let totalPages = 1

  do {
    const listFile = join(listDir, `page-${pad(page)}.json`)
    if (existsSync(listFile)) {
      const cached = JSON.parse(readFileSync(listFile, 'utf-8'))
      totalPages = cached.pagination.total_pages
      for (const ot of cached.data as { entry_id: string }[]) allIds.push(ot.entry_id)
      page++
      continue
    }
    const res = await listRepairOrders({ page, per_page: PER_PAGE })
    totalPages = res.pagination.total_pages
    writeFileSync(listFile, JSON.stringify(res, null, 2), 'utf-8')
    for (const ot of res.data) allIds.push(ot.entry_id)
    logger.info(`OTs (listado): página ${page}/${totalPages} guardada (${res.data.length} registros)`)
    page++
    if (page <= totalPages) await sleep(PAGE_DELAY_MS)
  } while (page <= totalPages)

  logger.info(`Listado de OTs completo: ${allIds.length} IDs recolectados`)

  logger.info('── Órdenes de trabajo: detalle por ID ──')
  const pending = allIds.filter((id) => !existsSync(join(detailDir, `${id}.json`))).slice(0, DETAIL_LIMIT)
  logger.info(`Pendientes de detalle: ${pending.length} de ${allIds.length} (ya respaldadas: ${allIds.length - pending.length})`)

  const limit = pLimit(CONCURRENCY)
  let done = 0
  await Promise.all(
    pending.map((id) =>
      limit(async () => {
        try {
          const detail = await getRepairOrder(id)
          writeFileSync(join(detailDir, `${id}.json`), JSON.stringify(detail, null, 2), 'utf-8')
        } catch (err) {
          logger.error(`Error detalle OT ${id}`, { error: (err as Error).message })
        } finally {
          done++
          if (done % 100 === 0 || done === pending.length) {
            logger.info(`OTs (detalle): ${done}/${pending.length} procesadas`)
          }
        }
      })
    )
  )

  logger.info(`✅ OTs respaldadas: ${allIds.length} en total`)
}

async function main(): Promise<void> {
  const target = process.argv[2] // 'customers' | 'vehicles' | 'repair-orders' | undefined (todos)

  console.log('\n─── Respaldo completo TallerGP (solo lectura) ───')
  console.log(`Destino: ${BACKUP_DIR}\n`)

  if (!target || target === 'customers') await backupCustomers()
  if (!target || target === 'vehicles') await backupVehicles()
  if (!target || target === 'repair-orders') await backupRepairOrders()

  console.log('\n✅ Respaldo completo.\n')
}

main().catch((err) => {
  logger.error('Error fatal en backup-full', { error: err.message })
  process.exit(1)
})

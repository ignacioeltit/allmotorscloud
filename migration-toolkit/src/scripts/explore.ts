/**
 * API Explorer — All Motors Migration Toolkit
 *
 * Uso:
 *   npm run explore                          # Explora customers, vehicles y repair-orders
 *   npm run explore -- --entity customers    # Solo clientes
 *   npm run explore -- --entity repair-orders --id 123  # Detalle de una OT
 *   npm run explore -- --limit 3            # Máximo 3 registros por entidad
 *
 * Solo usa GET. No modifica datos en TallerGP.
 */

import 'dotenv/config'
import { writeFileSync, mkdirSync } from 'fs'
import { join, resolve } from 'path'
import { logger } from '../utils/logger.js'
import { listCustomers, getCustomer } from '../api/tallergp/endpoints/customers.js'
import { listVehicles, getVehicle } from '../api/tallergp/endpoints/vehicles.js'
import { listRepairOrders, getRepairOrder } from '../api/tallergp/endpoints/repair-orders.js'
import { getBearerToken } from '../api/tallergp/auth.js'

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const getArg = (flag: string): string | undefined => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}
const hasFlag = (flag: string): boolean => args.includes(flag)

const entity = getArg('--entity') // 'customers' | 'vehicles' | 'repair-orders' | undefined
const targetId = getArg('--id')   // ID específico para ver detalle
const limit = Number(getArg('--limit') ?? '5')
const saveRaw = !hasFlag('--no-save')

// ─── Helpers ─────────────────────────────────────────────────────────────────

const exportDir = resolve(process.env.EXPORT_DIR ?? './exports')

function saveJson(filename: string, data: unknown): string {
  const dir = join(exportDir, 'raw')
  mkdirSync(dir, { recursive: true })
  const filepath = join(dir, filename)
  writeFileSync(filepath, JSON.stringify(data, null, 2), 'utf-8')
  return filepath
}

function printSummary(label: string, data: unknown[]): void {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${label} — ${data.length} registros`)
  console.log('═'.repeat(60))
  data.forEach((item: any, i) => {
    const id = item.id ?? item.entry_id ?? item.budget_id ?? '?'
    const name =
      item.name ?? item.plate ?? item.order_number ?? item.customer_number ?? ''
    const extra =
      item.lastname ? ` ${item.lastname}` :
      item.vin ? ` VIN:${item.vin}` :
      item.is_closed !== undefined ? ` [${item.is_closed ? 'cerrada' : 'abierta'}]` : ''
    console.log(`  ${String(i + 1).padStart(2)}. [${id}] ${name}${extra}`)
  })
}

function printDetail(label: string, data: unknown): void {
  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  DETALLE — ${label}`)
  console.log('═'.repeat(60))
  console.log(JSON.stringify(data, null, 2))
}

// ─── Exploradores por entidad ─────────────────────────────────────────────────

async function exploreCustomers(): Promise<void> {
  if (targetId) {
    logger.info(`Obteniendo detalle de cliente #${targetId}...`)
    const detail = await getCustomer(targetId)
    printDetail('Cliente', detail)
    if (saveRaw) {
      const path = saveJson(`customer_${targetId}.json`, detail)
      logger.info(`Guardado en ${path}`)
    }
    return
  }

  logger.info(`Listando clientes (limit=${limit})...`)
  const res = await listCustomers({ page: 1, per_page: limit })
  logger.info('Paginación', {
    total: res.pagination.total_count,
    paginas: res.pagination.total_pages,
    por_pagina: res.pagination.per_page,
  })
  printSummary('Clientes', res.data)

  if (saveRaw) {
    const path = saveJson(`customers_sample_${Date.now()}.json`, res)
    logger.info(`Guardado en ${path}`)
  }

  // Mostrar detalle del primero
  if (res.data.length > 0) {
    const first = res.data[0]
    logger.info(`Obteniendo detalle del cliente #${first.id}...`)
    const detail = await getCustomer(first.id)
    printDetail(`Cliente #${first.id}`, detail)
    if (saveRaw) {
      const path = saveJson(`customer_${first.id}_detail.json`, detail)
      logger.info(`Guardado en ${path}`)
    }
  }
}

async function exploreVehicles(): Promise<void> {
  if (targetId) {
    logger.info(`Obteniendo detalle de vehículo #${targetId}...`)
    const detail = await getVehicle(targetId)
    printDetail('Vehículo', detail)
    if (saveRaw) {
      const path = saveJson(`vehicle_${targetId}.json`, detail)
      logger.info(`Guardado en ${path}`)
    }
    return
  }

  logger.info(`Listando vehículos (limit=${limit})...`)
  const res = await listVehicles({ page: 1, per_page: limit })
  logger.info('Paginación', {
    total: res.pagination.total_count,
    paginas: res.pagination.total_pages,
  })
  printSummary('Vehículos', res.data)

  if (saveRaw) {
    const path = saveJson(`vehicles_sample_${Date.now()}.json`, res)
    logger.info(`Guardado en ${path}`)
  }
}

async function exploreRepairOrders(): Promise<void> {
  if (targetId) {
    logger.info(`Obteniendo detalle de OT #${targetId}...`)
    const detail = await getRepairOrder(targetId)
    printDetail('Orden de Reparación', detail)
    if (saveRaw) {
      const path = saveJson(`repair_order_${targetId}.json`, detail)
      logger.info(`Guardado en ${path}`)
    }
    return
  }

  logger.info(`Listando órdenes de reparación (limit=${limit})...`)
  const res = await listRepairOrders({ page: 1, per_page: limit })
  logger.info('Paginación', {
    total: res.pagination.total_count,
    paginas: res.pagination.total_pages,
  })
  printSummary('Órdenes de Reparación', res.data)

  if (saveRaw) {
    const path = saveJson(`repair_orders_sample_${Date.now()}.json`, res)
    logger.info(`Guardado en ${path}`)
  }

  // Mostrar detalle de la primera OT
  if (res.data.length > 0) {
    const first = res.data[0]
    logger.info(`Obteniendo detalle de OT #${first.entry_id}...`)
    const detail = await getRepairOrder(first.entry_id)
    printDetail(`Orden de Reparación #${first.entry_id}`, detail)
    if (saveRaw) {
      const path = saveJson(`repair_order_${first.entry_id}_detail.json`, detail)
      logger.info(`Guardado en ${path}`)
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\n🔍 All Motors — API Explorer (solo lectura)\n')

  // Verificar autenticación antes de cualquier request
  logger.info('Verificando autenticación...')
  try {
    await getBearerToken()
    logger.info('Autenticación OK')
  } catch (err) {
    logger.error('Error de autenticación', { error: (err as Error).message })
    logger.error('Revisa .env — necesitas TALLERGP_ACCESS_TOKEN o TALLERGP_CLIENT_ID + TALLERGP_CLIENT_SECRET')
    process.exit(1)
  }

  const entitiesToExplore = entity
    ? [entity]
    : ['customers', 'vehicles', 'repair-orders']

  for (const ent of entitiesToExplore) {
    try {
      switch (ent) {
        case 'customers':
          await exploreCustomers()
          break
        case 'vehicles':
          await exploreVehicles()
          break
        case 'repair-orders':
          await exploreRepairOrders()
          break
        default:
          logger.warn(`Entidad desconocida: ${ent}. Opciones: customers, vehicles, repair-orders`)
      }
    } catch (err) {
      logger.error(`Error explorando ${ent}`, { error: (err as Error).message })
    }

    // Pausa entre entidades para no saturar la API
    if (entitiesToExplore.indexOf(ent) < entitiesToExplore.length - 1) {
      await new Promise((r) => setTimeout(r, 500))
    }
  }

  console.log('\n✅ Explorer terminado.\n')
}

main().catch((err) => {
  logger.error('Error fatal', { error: err.message })
  process.exit(1)
})

/**
 * Data Discovery Engine — All Motors Cloud
 *
 * Descubre, analiza y documenta automáticamente toda la API oficial de TallerGP.
 * Solo usa GET. No modifica datos.
 *
 * Uso:
 *   npm run discover                          # Escanea todas las entidades
 *   npm run discover -- --entity customers    # Solo una entidad
 *   npm run discover -- --skip-detail        # Solo listados, sin detalle
 */

import './shared/env.js'
import { resolve, join } from 'path'
import { getBearerToken } from '@allmotors/migration-toolkit/api/tallergp/auth'
import { logger } from '@allmotors/migration-toolkit/utils/logger'
import { ENTITIES } from './config/entities.js'
import { scanEntity } from './core/entity-scanner.js'
import { buildCatalogEntry, writeCatalog } from './reporters/catalog.js'
import { writeEntityMarkdown } from './reporters/markdown.js'
import { writeSummaryReports } from './reporters/summary.js'
import type { EntityScanResult } from './core/entity-scanner.js'

// ── CLI args ──────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
const getArg = (flag: string): string | undefined => {
  const i = args.indexOf(flag)
  return i !== -1 ? args[i + 1] : undefined
}
const hasFlag = (flag: string): boolean => args.includes(flag)

const entityFilter = getArg('--entity')
const skipDetail = hasFlag('--skip-detail')
const rateLimitMs = Number(getArg('--delay') ?? '800')

// ── Paths ─────────────────────────────────────────────────────────────────────

const ROOT = resolve(import.meta.dirname ?? __dirname, '../../../..')
const DOCS_DIR = join(ROOT, 'docs', 'api-discovery')
const CATALOG_DIR = join(import.meta.dirname ?? __dirname, '../catalog')

// ── Main ─────────────────────────────────────────────────────────────────────

async function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

async function main(): Promise<void> {
  console.log('\n═══════════════════════════════════════════════════')
  console.log('  All Motors Cloud — Data Discovery Engine')
  console.log('  Solo lectura · No modifica datos en TallerGP')
  console.log('═══════════════════════════════════════════════════\n')

  // Auth check
  logger.info('Verificando autenticación...')
  try {
    await getBearerToken()
    logger.info('Auth OK')
  } catch (err) {
    logger.error('Error de autenticación', { error: (err as Error).message })
    process.exit(1)
  }

  // Select entities
  const entitiesToScan = entityFilter
    ? ENTITIES.filter((e) => e.key === entityFilter)
    : ENTITIES

  if (entitiesToScan.length === 0) {
    logger.error(`Entidad "${entityFilter}" no encontrada. Opciones: ${ENTITIES.map((e) => e.key).join(', ')}`)
    process.exit(1)
  }

  logger.info(`Escaneando ${entitiesToScan.length} entidad(es)...`)
  if (skipDetail) logger.info('Modo: solo listados (--skip-detail activo)')

  const results: EntityScanResult[] = []
  let successCount = 0
  let errorCount = 0

  for (const [i, config] of entitiesToScan.entries()) {
    console.log(`\n[${i + 1}/${entitiesToScan.length}] ${config.label} (${config.key})`)

    const configToScan = skipDetail ? { ...config, detailPath: null } : config

    const result = await scanEntity(configToScan)
    results.push(result)

    if (result.error) {
      errorCount++
      logger.error(`  ERROR: ${result.error}`)
    } else {
      successCount++
      const totalRecords = result.pagination?.totalCount ?? 0
      logger.info(`  Completado — ${totalRecords.toLocaleString('es-CL')} registros`, {
        campos_lista: result.listFields.length,
        campos_detalle_extra: result.additionalDetailFields.length,
        relaciones: result.relationships.length,
        recursos: result.resources.length,
      })
    }

    // Write reports for this entity immediately
    try {
      const catalogEntry = buildCatalogEntry(result)
      writeCatalog(CATALOG_DIR, catalogEntry)
      const mdPath = writeEntityMarkdown(DOCS_DIR, result)
      logger.info(`  → ${mdPath.replace(ROOT + '/', '')}`)
    } catch (err) {
      logger.warn(`  No se pudieron escribir reportes: ${(err as Error).message}`)
    }

    // Rate limit pause between entities
    if (i < entitiesToScan.length - 1) {
      await sleep(rateLimitMs)
    }
  }

  // Summary reports
  console.log('\n─── Generando reportes globales ───')
  try {
    writeSummaryReports(DOCS_DIR, results)
    logger.info(`→ docs/api-discovery/API_RELATIONSHIP_MAP.md`)
    logger.info(`→ docs/api-discovery/API_COVERAGE_REPORT.md`)
  } catch (err) {
    logger.error(`Error generando reportes globales: ${(err as Error).message}`)
  }

  // Final summary
  const totalRecords = results.reduce((s, r) => s + (r.pagination?.totalCount ?? 0), 0)
  const totalRelationships = results.reduce((s, r) => s + r.relationships.length, 0)
  const totalResources = results.reduce((s, r) => s + r.resources.length, 0)

  console.log('\n═══════════════════════════════════════════════════')
  console.log(`  Descubrimiento completado`)
  console.log(`  ✅ ${successCount} entidades exitosas · ❌ ${errorCount} con error`)
  console.log(`  📊 ${totalRecords.toLocaleString('es-CL')} registros totales descubiertos`)
  console.log(`  🔗 ${totalRelationships} relaciones detectadas`)
  console.log(`  📄 ${totalResources} recursos (PDF/CDN/URL)`)
  console.log(`  📁 Reportes en: docs/api-discovery/`)
  console.log('═══════════════════════════════════════════════════\n')
}

main().catch((err) => {
  logger.error('Error fatal', { error: err.message })
  process.exit(1)
})
